import { InboundReceiptCustomsClearanceStatus, Prisma } from '@prisma/client';

/**
 * Jumlah qty (basis / sama seperti inbound_receipts.qty_received) yang masih HELD di gudang transit.
 * Di gudang non-transit selalu 0.
 */
export async function sumInboundCustomsHeldQtyBase(
  tx: Prisma.TransactionClient,
  args: { customerId: string; warehouseId: string; binId: string; productId: string },
): Promise<Prisma.Decimal> {
  const wh = await tx.warehouse.findUnique({
    where: { id: args.warehouseId },
    select: { isTransitImportHub: true },
  });
  if (!wh?.isTransitImportHub) {
    return new Prisma.Decimal(0);
  }
  const agg = await tx.inboundReceipt.aggregate({
    where: {
      customerId: args.customerId,
      warehouseId: args.warehouseId,
      binId: args.binId,
      productId: args.productId,
      customsClearanceStatus: InboundReceiptCustomsClearanceStatus.HELD,
    },
    _sum: { qtyReceived: true },
  });
  return new Prisma.Decimal(agg._sum.qtyReceived ?? 0);
}

/** Satu query groupBy per produk + daftar bin (alokasi outbound). */
export async function mapInboundCustomsHeldQtyByBin(
  tx: Prisma.TransactionClient,
  args: { customerId: string; warehouseId: string; productId: string; binIds: string[] },
): Promise<Map<string, Prisma.Decimal>> {
  const out = new Map<string, Prisma.Decimal>();
  if (args.binIds.length === 0) return out;
  const wh = await tx.warehouse.findUnique({
    where: { id: args.warehouseId },
    select: { isTransitImportHub: true },
  });
  if (!wh?.isTransitImportHub) return out;

  const grouped = await tx.inboundReceipt.groupBy({
    by: ['binId'],
    where: {
      customerId: args.customerId,
      warehouseId: args.warehouseId,
      productId: args.productId,
      binId: { in: args.binIds },
      customsClearanceStatus: InboundReceiptCustomsClearanceStatus.HELD,
    },
    _sum: { qtyReceived: true },
  });
  for (const row of grouped) {
    out.set(row.binId, new Prisma.Decimal(row._sum.qtyReceived ?? 0));
  }
  return out;
}

export function effectiveQtyOnHandAfterCustomsHold(onHand: Prisma.Decimal, held: Prisma.Decimal): Prisma.Decimal {
  const eff = new Prisma.Decimal(onHand).minus(held);
  return eff.lte(0) ? new Prisma.Decimal(0) : eff;
}
