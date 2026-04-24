import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, BillingTransactionStatus } from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BillingSummaryQueryDto } from './dto/billing-summary-query.dto';
import { CreateBillingContractDto } from './dto/create-billing-contract.dto';
import { CreateBillingRateDto } from './dto/create-billing-rate.dto';
import { CreateBillingTransactionDto } from './dto/create-billing-transaction.dto';
import { DeleteMode } from './dto/delete-billing-entity.dto';
import { UpdateBillingContractDto } from './dto/update-billing-contract.dto';
import { UpdateBillingRateDto } from './dto/update-billing-rate.dto';
import { UpdateBillingTransactionDto } from './dto/update-billing-transaction.dto';

const SOFT_DELETED_REFERENCE = '__SOFT_DELETED__';

function canonicalPeriodKey(periodKey: string): string {
  const trimmed = periodKey.trim();
  const match = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (!match) return trimmed;
  const [, year, monthRaw] = match;
  const month = Number(monthRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12) return trimmed;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function periodKeyCandidates(periodKey?: string): string[] {
  if (!periodKey) return [];
  const canonical = canonicalPeriodKey(periodKey);
  const candidates = new Set<string>([canonical]);
  const match = /^(\d{4})-(\d{2})$/.exec(canonical);
  if (match) {
    const [, year, monthPadded] = match;
    candidates.add(`${year}-${String(Number(monthPadded))}`);
  }
  return [...candidates];
}

function activeBillingTransactionWhere(): Prisma.BillingTransactionWhereInput {
  return {
    OR: [{ referenceType: null }, { NOT: { referenceType: SOFT_DELETED_REFERENCE } }],
  };
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async listContracts(user: JwtPayload, customerId?: string) {
    const customerIds = await this.allowedCustomerIdsForUser(user);
    if (customerIds !== undefined && customerIds.length === 0) return [];
    return this.prisma.billingContract.findMany({
      where: {
        ...(customerIds ? { customerId: { in: customerIds } } : {}),
        ...(customerId ? { customerId } : {}),
      },
      include: { customer: true, rates: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createContract(dto: CreateBillingContractDto, user: JwtPayload) {
    await this.assertCustomerAllowedForUser(user, dto.customerId);
    await this.assertActiveCustomer(dto.customerId);
    const periodStart = new Date(dto.periodStart);
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : null;
    if (periodEnd && periodEnd < periodStart) {
      throw new BadRequestException('periodEnd cannot be earlier than periodStart');
    }

    try {
      return await this.prisma.billingContract.create({
        data: {
          customerId: dto.customerId,
          contractNo: dto.contractNo.trim().toUpperCase(),
          name: dto.name.trim(),
          periodStart,
          periodEnd,
          currency: (dto.currency ?? 'IDR').trim().toUpperCase(),
          billingCycleDay: dto.billingCycleDay ?? 1,
        },
        include: { customer: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Contract number already exists for this customer');
      }
      throw err;
    }
  }

  async updateContract(id: string, dto: UpdateBillingContractDto, user: JwtPayload) {
    const current = await this.assertContractExists(id);
    await this.assertCustomerAllowedForUser(user, current.customerId);
    if (dto.customerId) await this.assertCustomerAllowedForUser(user, dto.customerId);
    await this.assertActiveCustomer(dto.customerId ?? null);

    const periodStart = dto.periodStart ? new Date(dto.periodStart) : undefined;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : dto.periodEnd === null ? null : undefined;
    if (periodStart && periodEnd && periodEnd < periodStart) {
      throw new BadRequestException('periodEnd cannot be earlier than periodStart');
    }

    try {
      return await this.prisma.billingContract.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          contractNo: dto.contractNo?.trim().toUpperCase(),
          name: dto.name?.trim(),
          periodStart,
          periodEnd,
          currency: dto.currency?.trim().toUpperCase(),
          billingCycleDay: dto.billingCycleDay,
          isActive: dto.isActive,
        },
        include: { customer: true, rates: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Contract number already exists for this customer');
      }
      throw err;
    }
  }

  async deleteContract(id: string, mode: DeleteMode, user: JwtPayload) {
    const current = await this.assertContractExists(id);
    await this.assertCustomerAllowedForUser(user, current.customerId);
    if (mode === DeleteMode.HARD) {
      await this.prisma.$transaction([
        this.prisma.billingRate.deleteMany({ where: { contractId: id } }),
        this.prisma.billingContract.delete({ where: { id } }),
      ]);
      return { success: true, mode, id };
    }
    await this.prisma.billingContract.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listRates(user: JwtPayload, contractId?: string) {
    if (contractId) {
      await this.assertContractAllowedForUser(user, contractId);
    }
    const customerIds = await this.allowedCustomerIdsForUser(user);
    if (customerIds !== undefined && customerIds.length === 0) return [];
    return this.prisma.billingRate.findMany({
      where: {
        ...(contractId ? { contractId } : {}),
        ...(customerIds ? { contract: { customerId: { in: customerIds } } } : {}),
      },
      include: { contract: { include: { customer: true } } },
      orderBy: [{ isActive: 'desc' }, { activityCode: 'asc' }],
    });
  }

  async createRate(dto: CreateBillingRateDto, user: JwtPayload) {
    await this.assertContractAllowedForUser(user, dto.contractId);
    const contract = await this.prisma.billingContract.findUnique({
      where: { id: dto.contractId },
      select: { id: true, isActive: true },
    });
    if (!contract || !contract.isActive) {
      throw new BadRequestException('Billing contract not found or inactive');
    }

    try {
      return await this.prisma.billingRate.create({
        data: {
          contractId: dto.contractId,
          component: dto.component,
          activityCode: dto.activityCode.trim().toUpperCase(),
          uom: dto.uom.trim().toUpperCase(),
          rate: new Prisma.Decimal(dto.rate),
          minCharge: dto.minCharge !== undefined ? new Prisma.Decimal(dto.minCharge) : undefined,
        },
        include: { contract: { include: { customer: true } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Billing rate already exists for this contract/activity/UOM');
      }
      throw err;
    }
  }

  async updateRate(id: string, dto: UpdateBillingRateDto, user: JwtPayload) {
    const currentRate = await this.assertRateExists(id);
    await this.assertContractAllowedForUser(user, currentRate.contractId);
    if (dto.contractId) {
      await this.assertContractAllowedForUser(user, dto.contractId);
      const contract = await this.prisma.billingContract.findUnique({
        where: { id: dto.contractId },
        select: { id: true, isActive: true },
      });
      if (!contract || !contract.isActive) {
        throw new BadRequestException('Billing contract not found or inactive');
      }
    }

    try {
      return await this.prisma.billingRate.update({
        where: { id },
        data: {
          contractId: dto.contractId,
          component: dto.component,
          activityCode: dto.activityCode?.trim().toUpperCase(),
          uom: dto.uom?.trim().toUpperCase(),
          rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : undefined,
          minCharge: dto.minCharge !== undefined ? new Prisma.Decimal(dto.minCharge) : undefined,
          isActive: dto.isActive,
        },
        include: { contract: { include: { customer: true } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Billing rate already exists for this contract/activity/UOM');
      }
      throw err;
    }
  }

  async deleteRate(id: string, mode: DeleteMode, user: JwtPayload) {
    const currentRate = await this.assertRateExists(id);
    await this.assertContractAllowedForUser(user, currentRate.contractId);
    if (mode === DeleteMode.HARD) {
      await this.prisma.billingRate.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.billingRate.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listTransactions(user: JwtPayload, customerId?: string, periodKey?: string) {
    const periodKeys = periodKeyCandidates(periodKey);
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    if (!this.isSystemAdministrator(user) && !user.operatorCompanyId) return [];
    const operatorCompanyId = this.operatorScopeId(user);
    return this.prisma.billingTransaction.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(operatorCompanyId ? { operatorCompanyId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(periodKeys.length ? { periodKey: { in: periodKeys } } : {}),
        ...activeBillingTransactionWhere(),
      },
      include: {
        customer: true,
        warehouse: true,
        operatorCompany: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createTransaction(dto: CreateBillingTransactionDto, user: JwtPayload) {
    await this.assertActiveCustomer(dto.customerId);
    this.assertOperatorAllowed(user, dto.operatorCompanyId);
    this.assertWarehouseAllowed(user, dto.warehouseId);

    if (dto.warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
        select: { id: true, isActive: true },
      });
      if (!warehouse || !warehouse.isActive) {
        throw new BadRequestException('Warehouse not found or inactive');
      }
    }

    if (dto.operatorCompanyId) {
      const operator = await this.prisma.operatorCompany.findUnique({
        where: { id: dto.operatorCompanyId },
        select: { id: true, isActive: true },
      });
      if (!operator || !operator.isActive) {
        throw new BadRequestException('Operator company not found or inactive');
      }
    }

    return this.prisma.billingTransaction.create({
      data: {
        customerId: dto.customerId,
        warehouseId: dto.warehouseId,
        operatorCompanyId: dto.operatorCompanyId,
        component: dto.component,
        activityCode: dto.activityCode.trim().toUpperCase(),
        uom: dto.uom.trim().toUpperCase(),
        qty: new Prisma.Decimal(dto.qty),
        amount: new Prisma.Decimal(dto.amount),
        periodKey: canonicalPeriodKey(dto.periodKey),
        status: dto.status ?? BillingTransactionStatus.DRAFT,
        occurredAt: new Date(dto.occurredAt),
        referenceType: dto.referenceType?.trim().toUpperCase(),
        referenceId: dto.referenceId?.trim(),
        note: dto.note?.trim(),
      },
      include: {
        customer: true,
        warehouse: true,
        operatorCompany: true,
      },
    });
  }

  async updateTransaction(id: string, dto: UpdateBillingTransactionDto, user: JwtPayload) {
    const current = await this.assertTransactionExists(id);
    this.assertOperatorAllowed(user, current.operatorCompanyId ?? undefined);
    this.assertWarehouseAllowed(user, current.warehouseId ?? undefined);
    if (dto.customerId) await this.assertActiveCustomer(dto.customerId);
    this.assertOperatorAllowed(user, dto.operatorCompanyId);
    this.assertWarehouseAllowed(user, dto.warehouseId);

    if (dto.warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
        select: { id: true, isActive: true },
      });
      if (!warehouse || !warehouse.isActive) {
        throw new BadRequestException('Warehouse not found or inactive');
      }
    }

    if (dto.operatorCompanyId) {
      const operator = await this.prisma.operatorCompany.findUnique({
        where: { id: dto.operatorCompanyId },
        select: { id: true, isActive: true },
      });
      if (!operator || !operator.isActive) {
        throw new BadRequestException('Operator company not found or inactive');
      }
    }

    return this.prisma.billingTransaction.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        warehouseId: dto.warehouseId,
        operatorCompanyId: dto.operatorCompanyId,
        component: dto.component,
        activityCode: dto.activityCode?.trim().toUpperCase(),
        uom: dto.uom?.trim().toUpperCase(),
        qty: dto.qty !== undefined ? new Prisma.Decimal(dto.qty) : undefined,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        periodKey: dto.periodKey ? canonicalPeriodKey(dto.periodKey) : undefined,
        status: dto.status,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        referenceType: dto.referenceType?.trim().toUpperCase(),
        referenceId: dto.referenceId?.trim(),
        note: dto.note?.trim(),
      },
      include: {
        customer: true,
        warehouse: true,
        operatorCompany: true,
      },
    });
  }

  async softDeleteTransaction(id: string, user: JwtPayload) {
    const current = await this.assertTransactionExists(id);
    this.assertOperatorAllowed(user, current.operatorCompanyId ?? undefined);
    this.assertWarehouseAllowed(user, current.warehouseId ?? undefined);
    await this.prisma.billingTransaction.update({
      where: { id },
      data: {
        referenceType: SOFT_DELETED_REFERENCE,
        note: 'Soft deleted by API',
      },
    });
    return { success: true, mode: 'soft', id };
  }

  async getSummary(query: BillingSummaryQueryDto, user: JwtPayload) {
    await this.assertActiveCustomer(query.customerId);
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) {
      return {
        customerId: query.customerId,
        periodKey: canonicalPeriodKey(query.periodKey),
        totalLines: 0,
        totalQty: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        breakdown: [],
      };
    }
    if (!this.isSystemAdministrator(user) && !user.operatorCompanyId) {
      return {
        customerId: query.customerId,
        periodKey: canonicalPeriodKey(query.periodKey),
        totalLines: 0,
        totalQty: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        breakdown: [],
      };
    }
    const operatorCompanyId = this.operatorScopeId(user);
    const periodKeys = periodKeyCandidates(query.periodKey);

    const rows = await this.prisma.billingTransaction.groupBy({
      by: ['component', 'status'],
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(operatorCompanyId ? { operatorCompanyId } : {}),
        customerId: query.customerId,
        ...(periodKeys.length ? { periodKey: { in: periodKeys } } : { periodKey: query.periodKey }),
        ...activeBillingTransactionWhere(),
      },
      _sum: {
        qty: true,
        amount: true,
      },
      _count: {
        _all: true,
      },
    });

    const totals = await this.prisma.billingTransaction.aggregate({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(operatorCompanyId ? { operatorCompanyId } : {}),
        customerId: query.customerId,
        ...(periodKeys.length ? { periodKey: { in: periodKeys } } : { periodKey: query.periodKey }),
        ...activeBillingTransactionWhere(),
      },
      _sum: { amount: true, qty: true },
      _count: { _all: true },
    });
    const totalLines =
      typeof totals._count === 'object' && totals._count && '_all' in totals._count
        ? Number((totals._count as { _all?: number })._all ?? 0)
        : 0;
    const totalQty = totals._sum?.qty ?? new Prisma.Decimal(0);
    const totalAmount = totals._sum?.amount ?? new Prisma.Decimal(0);

    return {
      customerId: query.customerId,
      periodKey: canonicalPeriodKey(query.periodKey),
      totalLines,
      totalQty,
      totalAmount,
      breakdown: rows.map((row) => ({
        component: row.component,
        status: row.status,
        lines:
          typeof row._count === 'object' && row._count && '_all' in row._count
            ? Number((row._count as { _all?: number })._all ?? 0)
            : 0,
        qty: row._sum?.qty ?? new Prisma.Decimal(0),
        amount: row._sum?.amount ?? new Prisma.Decimal(0),
      })),
    };
  }

  private async assertActiveCustomer(id: string | null) {
    if (!id) return;
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }
  }

  private async assertContractExists(id: string) {
    const data = await this.prisma.billingContract.findUnique({
      where: { id },
      select: { id: true, customerId: true },
    });
    if (!data) throw new NotFoundException('Billing contract not found');
    return data;
  }

  private async assertRateExists(id: string) {
    const data = await this.prisma.billingRate.findUnique({
      where: { id },
      select: { id: true, contractId: true },
    });
    if (!data) throw new NotFoundException('Billing rate not found');
    return data;
  }

  private async assertTransactionExists(id: string) {
    const data = await this.prisma.billingTransaction.findUnique({
      where: { id },
      select: { id: true, warehouseId: true, operatorCompanyId: true },
    });
    if (!data) throw new NotFoundException('Billing transaction not found');
    return data;
  }

  private isSystemAdministrator(user?: JwtPayload): boolean {
    return Boolean(user?.roles?.includes('SYSTEM_ADMIN'));
  }

  private operatorScopeId(user?: JwtPayload): string | undefined {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    return user.operatorCompanyId ?? undefined;
  }

  private allowedWarehouseIds(user?: JwtPayload): string[] | undefined {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    return user.warehouseIds ?? [];
  }

  private assertWarehouseAllowed(user: JwtPayload, warehouseId?: string) {
    if (this.isSystemAdministrator(user)) return;
    if (!warehouseId) return;
    const ids = new Set(user.warehouseIds ?? []);
    if (ids.size === 0 || !ids.has(warehouseId)) {
      throwScopeForbidden('FORBIDDEN_SCOPE_WAREHOUSE', 'User is not allowed to access this warehouse');
    }
  }

  private assertOperatorAllowed(user: JwtPayload, operatorCompanyId?: string) {
    if (this.isSystemAdministrator(user)) return;
    if (!user.operatorCompanyId) {
      throwScopeForbidden('MISSING_SCOPE_OPERATOR', 'User has no operator scope');
    }
    if (operatorCompanyId && user.operatorCompanyId !== operatorCompanyId) {
      throwScopeForbidden('FORBIDDEN_SCOPE_OPERATOR', 'User is not allowed to access this operator company');
    }
  }

  private async allowedCustomerIdsForUser(user?: JwtPayload): Promise<string[] | undefined> {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    const warehouseIds = user.warehouseIds ?? [];
    if (warehouseIds.length === 0) return [];

    const dedicatedRows = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { customerId: true },
    });
    const dedicatedCustomerIds = dedicatedRows.map((r) => r.customerId).filter((id): id is string => Boolean(id));

    const mappedRows = await this.prisma.$queryRaw<Array<{ customerId: string }>>`
      SELECT wc.customer_id AS "customerId"
      FROM warehouse_customers wc
      WHERE wc.warehouse_id IN (${Prisma.join(warehouseIds)})
        AND wc.is_active = true
    `;
    const mappedCustomerIds = mappedRows.map((r) => r.customerId);
    return [...new Set([...dedicatedCustomerIds, ...mappedCustomerIds])];
  }

  private async assertCustomerAllowedForUser(user: JwtPayload, customerId: string) {
    if (this.isSystemAdministrator(user)) return;
    const allowedCustomerIds = await this.allowedCustomerIdsForUser(user);
    if (!allowedCustomerIds || allowedCustomerIds.includes(customerId)) return;
    throwScopeForbidden('FORBIDDEN_SCOPE_CUSTOMER', 'User is not allowed to access this customer');
  }

  private async assertContractAllowedForUser(user: JwtPayload, contractId: string) {
    if (this.isSystemAdministrator(user)) return;
    const contract = await this.prisma.billingContract.findUnique({
      where: { id: contractId },
      select: { id: true, customerId: true },
    });
    if (!contract) throw new NotFoundException('Billing contract not found');
    await this.assertCustomerAllowedForUser(user, contract.customerId);
  }
}
