import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlatformPlansService {
  constructor(private readonly platformDb: PlatformPrismaService) {}

  async listPlans() {
    const items = await this.platformDb.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return { items };
  }

  async getPlan(id: string) {
    const plan = await this.platformDb.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan not found: ${id}`);
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const existing = await this.platformDb.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Plan not found: ${id}`);

    return this.platformDb.plan.update({
      where: { id },
      data: {
        name: dto.name,
        maxWarehouses: dto.maxWarehouses,
        maxUsers: dto.maxUsers,
        maxCustomers: dto.maxCustomers,
        features: dto.features !== undefined ? (dto.features as object) : undefined,
        priceMonthly: dto.priceMonthly,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }
}
