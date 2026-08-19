import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { PlatformAuditQueryDto } from './dto/platform-audit-query.dto';

@Injectable()
export class PlatformAuditLogsService {
  constructor(private readonly platformDb: PlatformPrismaService) {}

  async listLogs(query: PlatformAuditQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.platformDb.platformAuditLog.findMany({
        where,
        include: {
          platformUser: { select: { id: true, email: true, name: true } },
          tenant: { select: { id: true, slug: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.platformDb.platformAuditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
