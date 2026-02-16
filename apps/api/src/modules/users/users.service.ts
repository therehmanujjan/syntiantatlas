import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto, QueryUsersDto, CreateStaffDto, AdminUpdateUserDto, SuspendUserDto, CreateAddressDto, UpdateAddressDto, CreateBankAccountDto, UpdateBankAccountDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto, ip?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });

    await this.auditService.log({
      userId,
      action: 'update_profile',
      entityType: 'user',
      entityId: userId,
      ipAddress: ip,
    });

    return this.sanitize(user);
  }

  async getWallet(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, walletBalance: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const recentTransactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      balance: user.walletBalance,
      recentTransactions,
    };
  }

  // Admin endpoints

  async findAll(query: QueryUsersDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.roleId) where.roleId = query.roleId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roleId: true,
          kycStatus: true,
          kycLevel: true,
          walletBalance: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            investments: true,
            transactions: true,
            properties: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async createStaff(dto: CreateStaffDto, adminId: number, ip?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) throw new ConflictException('Email already registered');

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const employeeId = `SA-${Date.now().toString(36).toUpperCase()}`;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        roleId: dto.roleId,
      },
    });

    await this.prisma.staffCredential.create({
      data: {
        userId: user.id,
        employeeId,
        tempPasswordHash: passwordHash,
        createdBy: adminId,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'create_staff',
      entityType: 'user',
      entityId: user.id,
      details: { roleId: dto.roleId, employeeId },
      ipAddress: ip,
    });

    return {
      ...this.sanitize(user),
      employeeId,
      temporaryPassword: tempPassword,
    };
  }

  async adminUpdateUser(userId: number, dto: AdminUpdateUserDto, adminId: number, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.roleId !== undefined) data.roleId = dto.roleId;

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    await this.auditService.log({
      userId: adminId,
      action: 'admin_update_user',
      entityType: 'user',
      entityId: userId,
      details: { changes: dto },
      ipAddress: ip,
    });

    return this.sanitize(updated);
  }

  async suspendUser(userId: number, dto: SuspendUserDto, adminId: number, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.roleId === 'admin') {
      throw new ForbiddenException('Cannot suspend an admin account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'suspended' },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'suspend_user',
      entityType: 'user',
      entityId: userId,
      details: { reason: dto.reason },
      ipAddress: ip,
    });

    return this.sanitize(updated);
  }

  async unsuspendUser(userId: number, adminId: number, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'unsuspend_user',
      entityType: 'user',
      entityId: userId,
      ipAddress: ip,
    });

    return this.sanitize(updated);
  }

  async deactivateUser(userId: number, adminId: number, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.roleId === 'admin') {
      throw new ForbiddenException('Cannot deactivate an admin account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'deactivated' },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'deactivate_user',
      entityType: 'user',
      entityId: userId,
      ipAddress: ip,
    });

    return this.sanitize(updated);
  }

  // ── Addresses ──

  async getAddresses(userId: number) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAddress(userId: number, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.userAddress.create({
      data: {
        userId,
        street: dto.street,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country ?? 'Pakistan',
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateAddress(userId: number, addressId: number, dto: UpdateAddressDto) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');

    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id: addressId },
      data: {
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async deleteAddress(userId: number, addressId: number) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');

    await this.prisma.userAddress.delete({ where: { id: addressId } });
    return { message: 'Address deleted' };
  }

  // ── Bank Accounts ──

  async getBankAccounts(userId: number) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBankAccount(userId: number, dto: CreateBankAccountDto) {
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.bankAccount.create({
      data: {
        userId,
        bankName: dto.bankName,
        accountTitle: dto.accountTitle,
        iban: dto.iban,
        branchCode: dto.branchCode,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateBankAccount(userId: number, accountId: number, dto: UpdateBankAccountDto) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { userId, id: { not: accountId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.bankAccount.update({
      where: { id: accountId },
      data: {
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.accountTitle !== undefined && { accountTitle: dto.accountTitle }),
        ...(dto.iban !== undefined && { iban: dto.iban }),
        ...(dto.branchCode !== undefined && { branchCode: dto.branchCode }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async deleteBankAccount(userId: number, accountId: number) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    await this.prisma.bankAccount.delete({ where: { id: accountId } });
    return { message: 'Bank account deleted' };
  }

  private sanitize(user: any) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
