import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewAlertDto, QueryAlertsDto } from './dto/aml.dto';

interface AmlAlert {
  transactionId: number;
  userId: number | null;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  status: string;
}

@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);

  /** Alert threshold constants */
  private static readonly HIGH_AMOUNT_THRESHOLD = 50000;
  private static readonly STRUCTURING_THRESHOLD = 20000;
  private static readonly STRUCTURING_WINDOW_HOURS = 1;
  private static readonly NEW_USER_THRESHOLD = 10000;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  // ===========================================================================
  // Scan a single transaction
  // ===========================================================================

  async scanTransaction(transactionId: number): Promise<AmlAlert[]> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            kycLevel: true,
            createdAt: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const alerts: AmlAlert[] = [];
    const amount = Number(transaction.amount);
    const userId = transaction.userId;

    // ---- Rule 1: High-value transaction > $50,000 ----
    if (amount > AmlService.HIGH_AMOUNT_THRESHOLD) {
      alerts.push({
        transactionId,
        userId,
        alertType: 'high_value_transaction',
        severity: 'HIGH',
        description: `Transaction amount $${amount.toLocaleString()} exceeds $${AmlService.HIGH_AMOUNT_THRESHOLD.toLocaleString()} threshold`,
        status: 'pending',
      });
    }

    // ---- Rule 2: Structuring detection ----
    if (userId) {
      const windowStart = new Date(
        new Date(transaction.createdAt || new Date()).getTime() -
          AmlService.STRUCTURING_WINDOW_HOURS * 60 * 60 * 1000,
      );

      const recentTransactions = await this.prisma.transaction.findMany({
        where: {
          userId,
          createdAt: { gte: windowStart },
          id: { not: transactionId },
        },
        select: { amount: true },
      });

      const totalInWindow = recentTransactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        amount,
      );

      if (totalInWindow > AmlService.STRUCTURING_THRESHOLD) {
        alerts.push({
          transactionId,
          userId,
          alertType: 'structuring_suspected',
          severity: 'MEDIUM',
          description: `Multiple transactions from user ${userId} within ${AmlService.STRUCTURING_WINDOW_HOURS}h totaling $${totalInWindow.toLocaleString()} (>${AmlService.STRUCTURING_THRESHOLD.toLocaleString()})`,
          status: 'pending',
        });
      }
    }

    // ---- Rule 3: Rapid deposit-then-withdrawal cycles ----
    if (userId && transaction.type === 'withdrawal') {
      const twoHoursAgo = new Date(
        new Date(transaction.createdAt || new Date()).getTime() - 2 * 60 * 60 * 1000,
      );

      const recentDeposits = await this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'deposit',
          createdAt: { gte: twoHoursAgo },
          status: 'completed',
        },
        select: { amount: true },
      });

      if (recentDeposits.length > 0) {
        const depositTotal = recentDeposits.reduce(
          (sum, tx) => sum + Number(tx.amount),
          0,
        );

        if (depositTotal > 0 && amount >= depositTotal * 0.8) {
          alerts.push({
            transactionId,
            userId,
            alertType: 'rapid_deposit_withdrawal',
            severity: 'MEDIUM',
            description: `Withdrawal of $${amount.toLocaleString()} shortly after deposits totaling $${depositTotal.toLocaleString()} — potential layering`,
            status: 'pending',
          });
        }
      }
    }

    // ---- Rule 4: New user high-value transaction ----
    if (userId && amount > AmlService.NEW_USER_THRESHOLD) {
      const user = transaction.user;
      if (user?.createdAt) {
        const accountAgeDays =
          (Date.now() - new Date(user.createdAt).getTime()) /
          (24 * 60 * 60 * 1000);

        if (accountAgeDays < 30) {
          alerts.push({
            transactionId,
            userId,
            alertType: 'new_user_high_value',
            severity: 'LOW',
            description: `First-month user (${Math.round(accountAgeDays)} days old) with transaction > $${AmlService.NEW_USER_THRESHOLD.toLocaleString()}`,
            status: 'pending',
          });
        }
      }
    }

    // Store each alert in audit_logs
    for (const alert of alerts) {
      await this.auditService.log({
        userId: alert.userId ?? undefined,
        action: 'aml_alert',
        entityType: 'transaction',
        entityId: transactionId,
        details: {
          transactionId: alert.transactionId,
          userId: alert.userId,
          alertType: alert.alertType,
          severity: alert.severity,
          description: alert.description,
          status: alert.status,
          amount,
          scannedAt: new Date().toISOString(),
        },
      });

      this.logger.warn(
        `AML Alert [${alert.severity}]: ${alert.alertType} — Transaction #${transactionId}`,
      );
    }

    return alerts;
  }

  // ===========================================================================
  // Batch scan recent transactions
  // ===========================================================================

  async scanAllRecentTransactions(hoursBack: number = 24) {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdAt: { gte: since },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(
      `Batch AML scan: ${transactions.length} transactions in last ${hoursBack}h`,
    );

    let totalAlerts = 0;
    const results: Array<{ transactionId: number; alertCount: number }> = [];

    for (const tx of transactions) {
      try {
        const alerts = await this.scanTransaction(tx.id);
        if (alerts.length > 0) {
          totalAlerts += alerts.length;
          results.push({ transactionId: tx.id, alertCount: alerts.length });
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to scan transaction ${tx.id}: ${error?.message}`,
        );
      }
    }

    // Notify admins if alerts were generated
    if (totalAlerts > 0) {
      try {
        // Find admin users to notify
        const admins = await this.prisma.user.findMany({
          where: { roleId: 'admin' },
          select: { id: true },
        });

        for (const admin of admins) {
          await this.notificationsService.create(
            admin.id,
            'aml_scan_complete',
            'AML Scan Complete',
            `Batch scan found ${totalAlerts} alert(s) across ${results.length} transaction(s) in the last ${hoursBack} hours.`,
            { totalAlerts, transactionsScanned: transactions.length },
          );
        }
      } catch {
        // Notification failure should not break the scan
      }
    }

    return {
      transactionsScanned: transactions.length,
      totalAlerts,
      flaggedTransactions: results,
      hoursBack,
      scannedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // Get alerts
  // ===========================================================================

  async getAlerts(query: QueryAlertsDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      action: 'aml_alert',
    };

    if (query.userId) {
      where.userId = query.userId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Post-filter by status and severity (stored in details JSON)
    let filtered = logs;
    if (query.status) {
      filtered = filtered.filter((log: any) => {
        const details = log.details as any;
        return details?.status === query.status;
      });
    }
    if (query.severity) {
      filtered = filtered.filter((log: any) => {
        const details = log.details as any;
        return details?.severity === query.severity;
      });
    }

    const alerts = filtered.map((log: any) => {
      const details = log.details as any;
      return {
        id: log.id,
        transactionId: details?.transactionId,
        userId: details?.userId,
        alertType: details?.alertType,
        severity: details?.severity,
        description: details?.description,
        status: details?.status,
        amount: details?.amount,
        scannedAt: details?.scannedAt,
        reviewedAt: details?.reviewedAt,
        reviewNotes: details?.reviewNotes,
        reviewedBy: details?.reviewedBy,
        user: log.user,
        createdAt: log.createdAt,
      };
    });

    return {
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // Get single alert
  // ===========================================================================

  async getAlert(alertId: number) {
    const log = await this.prisma.auditLog.findFirst({
      where: {
        id: alertId,
        action: 'aml_alert',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
            kycLevel: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`AML alert with ID ${alertId} not found`);
    }

    const details = (log as any).details as any;

    // Fetch related transaction if available
    let transaction = null;
    if (details?.transactionId) {
      transaction = await this.prisma.transaction.findUnique({
        where: { id: details.transactionId },
        select: {
          id: true,
          type: true,
          amount: true,
          gateway: true,
          status: true,
          createdAt: true,
        },
      });
    }

    return {
      id: log.id,
      transactionId: details?.transactionId,
      userId: details?.userId,
      alertType: details?.alertType,
      severity: details?.severity,
      description: details?.description,
      status: details?.status,
      amount: details?.amount,
      scannedAt: details?.scannedAt,
      reviewedAt: details?.reviewedAt,
      reviewNotes: details?.reviewNotes,
      reviewedByUserId: details?.reviewedBy,
      user: log.user,
      transaction,
      createdAt: log.createdAt,
    };
  }

  // ===========================================================================
  // Review an alert
  // ===========================================================================

  async reviewAlert(alertId: number, dto: ReviewAlertDto, reviewerId: number) {
    const log = await this.prisma.auditLog.findFirst({
      where: {
        id: alertId,
        action: 'aml_alert',
      },
    });

    if (!log) {
      throw new NotFoundException(`AML alert with ID ${alertId} not found`);
    }

    const existingDetails = (log.details as any) || {};

    // Update the alert details with review information
    const updatedDetails = {
      ...existingDetails,
      status: dto.status,
      reviewedAt: new Date().toISOString(),
      reviewNotes: dto.notes,
      reviewedBy: reviewerId,
    };

    await this.prisma.auditLog.update({
      where: { id: alertId },
      data: {
        details: updatedDetails,
      },
    });

    // Log the review action separately
    await this.auditService.log({
      userId: reviewerId,
      action: 'aml_alert_reviewed',
      entityType: 'aml_alert',
      entityId: alertId,
      details: {
        alertId,
        previousStatus: existingDetails.status,
        newStatus: dto.status,
        notes: dto.notes,
        transactionId: existingDetails.transactionId,
      },
    });

    this.logger.log(
      `AML Alert #${alertId} reviewed by user ${reviewerId}: ${existingDetails.status} -> ${dto.status}`,
    );

    return {
      message: 'Alert reviewed successfully',
      alertId,
      previousStatus: existingDetails.status,
      newStatus: dto.status,
      reviewedAt: updatedDetails.reviewedAt,
    };
  }

  // ===========================================================================
  // User risk profile
  // ===========================================================================

  async getUserRiskProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        kycStatus: true,
        kycLevel: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const factors: Array<{ factor: string; impact: number; description: string }> = [];
    let riskScore = 0;

    // ---- Factor 1: KYC level (0-25 points) ----
    const kycLevel = user.kycLevel || 0;
    let kycRisk: number;
    if (user.kycStatus === 'approved' && kycLevel >= 3) {
      kycRisk = 5;
      factors.push({
        factor: 'KYC Level',
        impact: kycRisk,
        description: `Fully verified (Level ${kycLevel})`,
      });
    } else if (user.kycStatus === 'approved' && kycLevel >= 2) {
      kycRisk = 10;
      factors.push({
        factor: 'KYC Level',
        impact: kycRisk,
        description: `Verified (Level ${kycLevel})`,
      });
    } else if (user.kycStatus === 'approved') {
      kycRisk = 15;
      factors.push({
        factor: 'KYC Level',
        impact: kycRisk,
        description: `Basic verification (Level ${kycLevel})`,
      });
    } else {
      kycRisk = 25;
      factors.push({
        factor: 'KYC Level',
        impact: kycRisk,
        description: `KYC not approved (status: ${user.kycStatus})`,
      });
    }
    riskScore += kycRisk;

    // ---- Factor 2: Transaction patterns (0-30 points) ----
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      select: { amount: true, type: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalVolume = transactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );

    let txRisk: number;
    if (totalVolume > 500000) {
      txRisk = 30;
      factors.push({
        factor: 'Transaction Volume',
        impact: txRisk,
        description: `Very high volume: $${totalVolume.toLocaleString()}`,
      });
    } else if (totalVolume > 100000) {
      txRisk = 20;
      factors.push({
        factor: 'Transaction Volume',
        impact: txRisk,
        description: `High volume: $${totalVolume.toLocaleString()}`,
      });
    } else if (totalVolume > 25000) {
      txRisk = 10;
      factors.push({
        factor: 'Transaction Volume',
        impact: txRisk,
        description: `Moderate volume: $${totalVolume.toLocaleString()}`,
      });
    } else {
      txRisk = 5;
      factors.push({
        factor: 'Transaction Volume',
        impact: txRisk,
        description: `Low volume: $${totalVolume.toLocaleString()}`,
      });
    }
    riskScore += txRisk;

    // ---- Factor 3: Alert history (0-30 points) ----
    const alertLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'aml_alert',
        userId,
      },
    });

    const totalAlerts = alertLogs.length;
    const pendingAlerts = alertLogs.filter(
      (log: any) => (log.details as any)?.status === 'pending',
    ).length;
    const escalatedAlerts = alertLogs.filter(
      (log: any) => (log.details as any)?.status === 'escalated',
    ).length;
    const highSeverityAlerts = alertLogs.filter(
      (log: any) => (log.details as any)?.severity === 'HIGH',
    ).length;

    let alertRisk: number;
    if (highSeverityAlerts > 0 || escalatedAlerts > 0) {
      alertRisk = 30;
      factors.push({
        factor: 'Alert History',
        impact: alertRisk,
        description: `${totalAlerts} total alerts (${highSeverityAlerts} HIGH, ${escalatedAlerts} escalated, ${pendingAlerts} pending)`,
      });
    } else if (totalAlerts > 5) {
      alertRisk = 20;
      factors.push({
        factor: 'Alert History',
        impact: alertRisk,
        description: `${totalAlerts} total alerts — frequent flags`,
      });
    } else if (totalAlerts > 0) {
      alertRisk = 10;
      factors.push({
        factor: 'Alert History',
        impact: alertRisk,
        description: `${totalAlerts} total alert(s)`,
      });
    } else {
      alertRisk = 0;
      factors.push({
        factor: 'Alert History',
        impact: alertRisk,
        description: 'No previous alerts',
      });
    }
    riskScore += alertRisk;

    // ---- Factor 4: Account age (0-15 points) ----
    const accountAgeDays = user.createdAt
      ? (Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      : 0;

    let ageRisk: number;
    if (accountAgeDays < 30) {
      ageRisk = 15;
      factors.push({
        factor: 'Account Age',
        impact: ageRisk,
        description: `New account (${Math.round(accountAgeDays)} days)`,
      });
    } else if (accountAgeDays < 90) {
      ageRisk = 10;
      factors.push({
        factor: 'Account Age',
        impact: ageRisk,
        description: `Recent account (${Math.round(accountAgeDays)} days)`,
      });
    } else if (accountAgeDays < 365) {
      ageRisk = 5;
      factors.push({
        factor: 'Account Age',
        impact: ageRisk,
        description: `Established account (${Math.round(accountAgeDays)} days)`,
      });
    } else {
      ageRisk = 0;
      factors.push({
        factor: 'Account Age',
        impact: ageRisk,
        description: `Mature account (${Math.round(accountAgeDays / 365)} years)`,
      });
    }
    riskScore += ageRisk;

    // Clamp to 1-100 range
    riskScore = Math.min(100, Math.max(1, riskScore));

    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore <= 30) {
      riskLevel = 'low';
    } else if (riskScore <= 60) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      userId,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      riskScore,
      riskLevel,
      factors,
      transactionSummary: {
        totalTransactions: transactions.length,
        totalVolume,
      },
      alertSummary: {
        totalAlerts,
        pendingAlerts,
        escalatedAlerts,
        highSeverityAlerts,
      },
      accountAge: Math.round(accountAgeDays),
    };
  }

  // ===========================================================================
  // Dashboard stats
  // ===========================================================================

  async getDashboardStats() {
    const allAlerts = await this.prisma.auditLog.findMany({
      where: { action: 'aml_alert' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Counts by status
    const statusCounts: Record<string, number> = {
      pending: 0,
      reviewed: 0,
      escalated: 0,
      cleared: 0,
      reported: 0,
    };

    const severityCounts: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    const highRiskUserIds = new Set<number>();

    for (const log of allAlerts) {
      const details = (log as any).details as any;
      const status = details?.status || 'pending';
      const severity = details?.severity || 'LOW';

      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
      if (severityCounts[severity] !== undefined) {
        severityCounts[severity]++;
      }

      // Track users with HIGH severity or escalated alerts
      if (
        (severity === 'HIGH' || status === 'escalated') &&
        details?.userId
      ) {
        highRiskUserIds.add(details.userId);
      }
    }

    // Recent alerts (last 10)
    const recentAlerts = allAlerts.slice(0, 10).map((log: any) => {
      const details = log.details as any;
      return {
        id: log.id,
        alertType: details?.alertType,
        severity: details?.severity,
        status: details?.status,
        transactionId: details?.transactionId,
        userId: details?.userId,
        description: details?.description,
        user: log.user,
        createdAt: log.createdAt,
      };
    });

    return {
      totalAlerts: allAlerts.length,
      alertsByStatus: statusCounts,
      alertsBySeverity: severityCounts,
      highRiskUsersCount: highRiskUserIds.size,
      recentAlerts,
      lastUpdated: new Date().toISOString(),
    };
  }
}
