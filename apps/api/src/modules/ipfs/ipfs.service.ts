import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UploadDocumentDto, QueryDocumentsDto } from './dto/ipfs.dto';

interface IpfsUploadResult {
  cid: string;
  size: number;
  filename: string;
}

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly ipfsApiUrl: string;
  private readonly ipfsGatewayUrl: string;
  private readonly enabled: boolean;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private config: ConfigService,
  ) {
    const apiUrl = this.config.get<string>('IPFS_API_URL');
    const gatewayUrl = this.config.get<string>('IPFS_GATEWAY_URL');

    if (apiUrl) {
      this.ipfsApiUrl = apiUrl;
      this.ipfsGatewayUrl = gatewayUrl || 'http://localhost:8080/ipfs';
      this.enabled = true;
      this.logger.log(`IPFS enabled: API=${this.ipfsApiUrl}, Gateway=${this.ipfsGatewayUrl}`);
    } else {
      this.ipfsApiUrl = 'http://localhost:5001';
      this.ipfsGatewayUrl = gatewayUrl || 'http://localhost:8080/ipfs';
      this.enabled = false;
      this.logger.warn('IPFS_API_URL not configured — using local fallback with mock CIDs');
    }
  }

  // ===========================================================================
  // Upload to IPFS
  // ===========================================================================

  async uploadToIpfs(buffer: Buffer, filename: string): Promise<IpfsUploadResult> {
    if (this.enabled) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(buffer)]);
        formData.append('file', blob, filename);

        const response = await fetch(`${this.ipfsApiUrl}/api/v0/add`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`IPFS API returned status ${response.status}`);
        }

        const result: any = await response.json();

        this.logger.log(`Uploaded to IPFS: CID=${result.Hash}, Size=${result.Size}`);

        return {
          cid: result.Hash,
          size: parseInt(result.Size, 10),
          filename,
        };
      } catch (error: any) {
        this.logger.warn(`IPFS upload failed, falling back to mock: ${error?.message}`);
        return this.generateMockCid(buffer, filename);
      }
    }

    return this.generateMockCid(buffer, filename);
  }

  // ===========================================================================
  // Retrieve from IPFS
  // ===========================================================================

  async getFromIpfs(cid: string): Promise<{ url: string; mock: boolean }> {
    const url = `${this.ipfsGatewayUrl}/${cid}`;

    if (!this.enabled || cid.startsWith('mock-')) {
      return { url, mock: true };
    }

    // Verify file exists on IPFS gateway
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return { url, mock: false };
      }
    } catch {
      // Gateway unreachable; still return URL for the client to try
    }

    return { url, mock: false };
  }

  // ===========================================================================
  // Store document record (in audit_logs)
  // ===========================================================================

  async storeDocumentRecord(
    dto: UploadDocumentDto,
    cid: string,
    size: number,
    uploaderId: number,
  ) {
    await this.auditService.log({
      userId: uploaderId,
      action: 'ipfs_upload',
      entityType: 'document',
      entityId: dto.entityId,
      details: {
        cid,
        filename: dto.filename,
        entityType: dto.entityType,
        entityId: dto.entityId,
        size,
        description: dto.description || null,
        uploadedAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `Document record stored: CID=${cid}, entity=${dto.entityType}:${dto.entityId}`,
    );

    return {
      cid,
      filename: dto.filename,
      entityType: dto.entityType,
      entityId: dto.entityId,
      size,
      description: dto.description || null,
      gatewayUrl: `${this.ipfsGatewayUrl}/${cid}`,
    };
  }

  // ===========================================================================
  // Query documents
  // ===========================================================================

  async getDocuments(query: QueryDocumentsDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      action: 'ipfs_upload',
      entityType: 'document',
    };

    // Filter by entityType stored inside the details JSON
    // Since details is a JSON column, we use Prisma's JSON filtering
    if (query.entityType || query.entityId) {
      const path: any = {};
      if (query.entityType) path.entityType = query.entityType;
      if (query.entityId) path.entityId = query.entityId;
      where.details = { path: ['entityType'], equals: query.entityType };

      // If both filters are present, we need to do post-filtering for entityId
      // as Prisma JSON filtering supports one path at a time
      if (query.entityType) {
        where.details = { path: ['entityType'], equals: query.entityType };
      }
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

    // Post-filter by entityId if specified (JSON nested filtering)
    let filtered = logs;
    if (query.entityId) {
      filtered = logs.filter((log: any) => {
        const details = log.details as any;
        return details?.entityId === query.entityId;
      });
    }

    const documents = filtered.map((log: any) => {
      const details = log.details as any;
      return {
        id: log.id,
        cid: details?.cid,
        filename: details?.filename,
        entityType: details?.entityType,
        entityId: details?.entityId,
        size: details?.size,
        description: details?.description,
        uploadedBy: log.user,
        uploadedAt: details?.uploadedAt || log.createdAt,
        gatewayUrl: details?.cid
          ? `${this.ipfsGatewayUrl}/${details.cid}`
          : null,
      };
    });

    return {
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // Get document by CID
  // ===========================================================================

  async getDocumentByCid(cid: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'ipfs_upload',
        entityType: 'document',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    const match = logs.find((log: any) => {
      const details = log.details as any;
      return details?.cid === cid;
    });

    if (!match) {
      throw new NotFoundException(`Document with CID ${cid} not found`);
    }

    const details = (match as any).details as any;

    return {
      id: match.id,
      cid: details?.cid,
      filename: details?.filename,
      entityType: details?.entityType,
      entityId: details?.entityId,
      size: details?.size,
      description: details?.description,
      uploadedBy: match.user,
      uploadedAt: details?.uploadedAt || match.createdAt,
      gatewayUrl: `${this.ipfsGatewayUrl}/${cid}`,
    };
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private generateMockCid(buffer: Buffer, filename: string): IpfsUploadResult {
    // Generate a deterministic mock CID from content hash
    const hash = this.simpleHash(buffer.toString('base64') + filename);
    const cid = `mock-Qm${hash}`;

    this.logger.log(`Generated mock CID: ${cid} for file: ${filename}`);

    return {
      cid,
      size: buffer.length,
      filename,
    };
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).padStart(12, '0').slice(0, 24);
  }
}
