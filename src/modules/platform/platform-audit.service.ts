import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';

@Injectable()
export class PlatformAuditService {
  constructor(private readonly platformDb: PlatformPrismaService) {}

  async log(
    platformUserId: string | null,
    action: string,
    options?: { tenantId?: string; metadata?: Record<string, unknown> },
  ) {
    return this.platformDb.platformAuditLog.create({
      data: {
        platformUserId,
        tenantId: options?.tenantId,
        action,
        metadata: (options?.metadata ?? {}) as object,
      },
    });
  }
}
