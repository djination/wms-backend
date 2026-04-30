import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BillingComponent,
  BillingTransactionStatus,
  InboundAsnStatus,
  InternalTransferStatus,
  MaterialTransformationStatus,
  OutboundTaskStatus,
  Prisma,
  SalesOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { KpiQueryDto } from './dto/kpi-query.dto';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: KpiQueryDto, user: JwtPayload) {
    const { from, to, warehouseId, customerId } = this.resolvePeriod(query);
    const allowedWarehouseIds = this.allowedWarehouseIds(user);
    if (allowedWarehouseIds !== undefined && allowedWarehouseIds.length === 0) {
      throwScopeForbidden('MISSING_SCOPE_WAREHOUSE', 'No warehouse scope assigned for this user');
    }
    if (warehouseId && allowedWarehouseIds && !allowedWarehouseIds.includes(warehouseId)) {
      throwScopeForbidden('FORBIDDEN_SCOPE_WAREHOUSE', 'Requested warehouse is outside user scope');
    }
    const warehouseScopeWhere =
      warehouseId
        ? { warehouseId }
        : allowedWarehouseIds && allowedWarehouseIds.length > 0
          ? { warehouseId: { in: allowedWarehouseIds } }
          : {};

    const baseAsnFilter: Prisma.InboundAsnWhereInput = {
      ...warehouseScopeWhere,
      ...(customerId ? { customerId } : {}),
    };

    const asnWhereCreatedInPeriod: Prisma.InboundAsnWhereInput = {
      ...baseAsnFilter,
      createdAt: { gte: from, lte: to },
    };

    const asnWhereCompletedInPeriod: Prisma.InboundAsnWhereInput = {
      ...baseAsnFilter,
      status: InboundAsnStatus.COMPLETED,
      updatedAt: { gte: from, lte: to },
    };

    const [asnByStatus, completedAsnsForAccuracy] = await Promise.all([
      this.prisma.inboundAsn.groupBy({
        by: ['status'],
        where: asnWhereCreatedInPeriod,
        _count: { _all: true },
      }),
      this.prisma.inboundAsn.findMany({
        where: asnWhereCompletedInPeriod,
        select: {
          items: {
            select: { qtyExpected: true, qtyReceived: true },
          },
        },
      }),
    ]);

    let inboundExpected = new Prisma.Decimal(0);
    let inboundReceived = new Prisma.Decimal(0);
    let inboundDiscrepancyLines = 0;
    for (const asn of completedAsnsForAccuracy) {
      for (const line of asn.items) {
        inboundExpected = inboundExpected.plus(line.qtyExpected);
        inboundReceived = inboundReceived.plus(line.qtyReceived);
        if (line.qtyReceived.lessThan(line.qtyExpected)) {
          inboundDiscrepancyLines += 1;
        }
      }
    }
    const receivingFillRate =
      inboundExpected.greaterThan(0)
        ? Number(inboundReceived.div(inboundExpected).toFixed(6))
        : null;

    const orderWhere: Prisma.SalesOrderWhereInput = {
      ...warehouseScopeWhere,
      ...(customerId ? { customerId } : {}),
      createdAt: { gte: from, lte: to },
    };

    const shippedOrderWhere: Prisma.SalesOrderWhereInput = {
      ...warehouseScopeWhere,
      ...(customerId ? { customerId } : {}),
      status: SalesOrderStatus.SHIPPED,
      shippedAt: { gte: from, lte: to },
    };

    const [ordersByStatus, ordersForFulfillment, shippedOrders, taskRows] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where: orderWhere,
        _count: { _all: true },
      }),
      this.prisma.salesOrder.findMany({
        where: orderWhere,
        select: {
          items: { select: { qtyOrdered: true, qtyShipped: true } },
        },
      }),
      this.prisma.salesOrder.findMany({
        where: shippedOrderWhere,
        select: {
          id: true,
          items: { select: { qtyOrdered: true, qtyShipped: true } },
        },
      }),
      this.prisma.outboundTask.groupBy({
        by: ['status'],
        where: {
          ...warehouseScopeWhere,
          ...(customerId
            ? { salesOrder: { is: { customerId } } }
            : {}),
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
      }),
    ]);

    let orderedQty = new Prisma.Decimal(0);
    let shippedQty = new Prisma.Decimal(0);
    for (const o of ordersForFulfillment) {
      for (const it of o.items) {
        orderedQty = orderedQty.plus(it.qtyOrdered);
        shippedQty = shippedQty.plus(it.qtyShipped);
      }
    }
    const orderFulfillmentRate =
      orderedQty.greaterThan(0) ? Number(shippedQty.div(orderedQty).toFixed(6)) : null;

    const taskTotal = taskRows.reduce((s, r) => s + r._count._all, 0);
    const taskDone =
      taskRows.find((r) => r.status === OutboundTaskStatus.DONE)?._count._all ?? 0;
    const taskCompletionRate =
      taskTotal > 0 ? Number((taskDone / taskTotal).toFixed(6)) : null;

    const invWhere: Prisma.InventoryBalanceWhereInput = {
      ...warehouseScopeWhere,
      ...(customerId ? { customerId } : {}),
      qtyOnHand: { gt: 0 },
    };

    const [invAgg, binsUsed, binsTotal] = await Promise.all([
      this.prisma.inventoryBalance.aggregate({
        where: invWhere,
        _sum: { qtyOnHand: true },
        _count: { _all: true },
      }),
      this.prisma.inventoryBalance.groupBy({
        by: ['binId'],
        where: invWhere,
      }),
      this.prisma.warehouseBin.count({
        where: {
          isActive: true,
          ...warehouseScopeWhere,
        },
      }),
    ]);

    const billingWhere: Prisma.BillingTransactionWhereInput = {
      ...warehouseScopeWhere,
      ...(customerId ? { customerId } : {}),
      occurredAt: { gte: from, lte: to },
    };

    const [billingByStatus, billingByComponent, completedTransfers, completedTransforms] = await Promise.all([
      this.prisma.billingTransaction.groupBy({
        by: ['status'],
        where: billingWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.billingTransaction.groupBy({
        by: ['component', 'status'],
        where: billingWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      (() => {
        const internalTransferWhere: Prisma.InternalTransferWhereInput = {
          status: InternalTransferStatus.COMPLETED,
          completedAt: { gte: from, lte: to },
          ...(customerId ? { customerId } : {}),
        };
        if (warehouseId) {
          internalTransferWhere.OR = [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }];
        } else if (allowedWarehouseIds !== undefined && allowedWarehouseIds.length > 0) {
          internalTransferWhere.OR = [
            { fromWarehouseId: { in: allowedWarehouseIds } },
            { toWarehouseId: { in: allowedWarehouseIds } },
          ];
        }
        return this.prisma.internalTransfer.findMany({
          where: internalTransferWhere,
          select: { lines: { select: { qty: true } } },
        });
      })(),
      this.prisma.materialTransformation.findMany({
        where: {
          status: MaterialTransformationStatus.COMPLETED,
          completedAt: { gte: from, lte: to },
          ...(customerId ? { customerId } : {}),
          ...warehouseScopeWhere,
        },
        select: { qtyOutput: true, inputs: { select: { qtyConsumed: true } } },
      }),
    ]);

    let transferQtyMoved = new Prisma.Decimal(0);
    for (const t of completedTransfers) {
      for (const line of t.lines) {
        transferQtyMoved = transferQtyMoved.plus(line.qty);
      }
    }
    let transformationOutputQty = new Prisma.Decimal(0);
    let transformationInputQty = new Prisma.Decimal(0);
    for (const t of completedTransforms) {
      transformationOutputQty = transformationOutputQty.plus(t.qtyOutput);
      for (const inp of t.inputs) {
        transformationInputQty = transformationInputQty.plus(inp.qtyConsumed);
      }
    }
    const kitchenYieldRatio =
      transformationInputQty.greaterThan(0)
        ? Number(transformationOutputQty.div(transformationInputQty).toFixed(6))
        : null;

    const billingPosted = billingByStatus.find((b) => b.status === BillingTransactionStatus.POSTED);
    const billingDraft = billingByStatus.find((b) => b.status === BillingTransactionStatus.DRAFT);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      filters: { warehouseId: warehouseId ?? null, customerId: customerId ?? null },
      inbound: {
        asnCountByStatusCreatedInPeriod: Object.fromEntries(
          asnByStatus.map((r) => [r.status, r._count._all]),
        ) as Partial<Record<InboundAsnStatus, number>>,
        completedAsnCountClosedInPeriod: completedAsnsForAccuracy.length,
        receivingFillRate,
        lineDiscrepancyCountBelowExpected: inboundDiscrepancyLines,
        qtyExpectedInCompletedAsns: inboundExpected.toString(),
        qtyReceivedInCompletedAsns: inboundReceived.toString(),
      },
      outbound: {
        ordersCreatedInPeriodByStatus: Object.fromEntries(
          ordersByStatus.map((r) => [r.status, r._count._all]),
        ) as Partial<Record<SalesOrderStatus, number>>,
        shippedOrdersInPeriod: shippedOrders.length,
        orderFulfillmentRateByQty: orderFulfillmentRate,
        orderedQtyInPeriod: orderedQty.toString(),
        shippedQtyInPeriod: shippedQty.toString(),
        outboundTasksCreatedInPeriodByStatus: Object.fromEntries(
          taskRows.map((r) => [r.status, r._count._all]),
        ) as Partial<Record<OutboundTaskStatus, number>>,
        taskCompletionRate,
      },
      inventory: {
        snapshotAsOf: new Date().toISOString(),
        totalQtyOnHand: invAgg._sum.qtyOnHand?.toString() ?? '0',
        balanceLineCount: invAgg._count._all,
        binsWithStock: binsUsed.length,
        binsTotalActive: binsTotal,
        spaceUtilizationRate:
          binsTotal > 0 ? Number((binsUsed.length / binsTotal).toFixed(6)) : null,
      },
      billing: {
        amountPosted: billingPosted?._sum.amount?.toString() ?? '0',
        linesPosted: billingPosted?._count._all ?? 0,
        amountDraft: billingDraft?._sum.amount?.toString() ?? '0',
        linesDraft: billingDraft?._count._all ?? 0,
        byComponentAndStatus: billingByComponent.map((row) => ({
          component: row.component as BillingComponent,
          status: row.status,
          lines: row._count._all,
          amount: row._sum.amount?.toString() ?? '0',
        })),
      },
      processFlow: {
        transfersCompletedInPeriod: completedTransfers.length,
        transferQtyMovedInPeriod: transferQtyMoved.toString(),
        transformationsCompletedInPeriod: completedTransforms.length,
        transformationOutputQtyInPeriod: transformationOutputQty.toString(),
        transformationInputQtyConsumedInPeriod: transformationInputQty.toString(),
        kitchenYieldRatioOutputOverInput: kitchenYieldRatio,
      },
    };
  }

  private isSystemAdministrator(user?: JwtPayload): boolean {
    return Boolean(user?.roles?.includes('SYSTEM_ADMIN'));
  }

  private allowedWarehouseIds(user?: JwtPayload): string[] | undefined {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    return user.warehouseIds ?? [];
  }

  private resolvePeriod(query: KpiQueryDto): {
    from: Date;
    to: Date;
    warehouseId?: string;
    customerId?: string;
  } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (from > to) {
      throw new BadRequestException('Query parameter "from" must be before or equal to "to"');
    }
    return {
      from,
      to,
      warehouseId: query.warehouseId,
      customerId: query.customerId,
    };
  }
}
