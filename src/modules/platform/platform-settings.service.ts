import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly platformDb: PlatformPrismaService) {}

  async listSettings() {
    const rows = await this.platformDb.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return { items: rows };
  }

  async getSetting(key: string) {
    return this.platformDb.platformSetting.findUnique({ where: { key } });
  }

  async upsertSetting(key: string, value: Record<string, unknown>) {
    return this.platformDb.platformSetting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
  }
}
