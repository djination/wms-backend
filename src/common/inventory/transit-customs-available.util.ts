import { Prisma } from '@prisma/client';

/** Net on-hand for allocation/picking after inbound customs hold (non-negative). */
export function effectiveQtyOnHandAfterCustomsHold(
  onHand: Prisma.Decimal,
  inboundCustomsHeldBase: Prisma.Decimal,
): Prisma.Decimal {
  const net = onHand.minus(inboundCustomsHeldBase);
  return net.lessThan(0) ? new Prisma.Decimal(0) : net;
}

type CustomsHeldScope = {
  customerId: string;
  warehouseId: string;
  productId: string;
};

/**
 * Sum of qty still on inbound customs HELD at a bin/product (base UOM qty on receipt rows).
 * When receipt customs columns exist, aggregate HELD rows here; until then returns zero.
 */
export async function sumInboundCustomsHeldQtyBase(
  _tx: Prisma.TransactionClient,
  _scope: CustomsHeldScope & { binId: string },
): Promise<Prisma.Decimal> {
  return new Prisma.Decimal(0);
}

/**
 * Per-bin HELD qty (base) for a product in the warehouse. Missing bins are treated as zero by callers.
 */
export async function mapInboundCustomsHeldQtyByBin(
  _tx: Prisma.TransactionClient,
  _scope: CustomsHeldScope & { binIds: string[] },
): Promise<Map<string, Prisma.Decimal>> {
  return new Map();
}
