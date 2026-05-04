import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingComponent,
  BillingTransactionStatus,
  InboundAsnStatus,
  InboundReceiptCustomsClearanceStatus,
  Prisma,
  WarehouseType,
} from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateAsnDto } from './dto/create-asn.dto';
import { ReceiveAsnItemDto } from './dto/receive-asn-item.dto';
import { UpdateAsnDto } from './dto/update-asn.dto';
import { UpdateAsnItemsDto } from './dto/update-asn-items.dto';

@Injectable()
export class InboundService {
  /** Draft billing: `STORAGE` + rate aktif per kontrak customer (opsional). */
  static readonly TRANSIT_CUSTOMS_DWELL_ACTIVITY_CODE = 'TRANSIT_CUSTOMS_DWELL_DAY';

  constructor(private readonly prisma: PrismaService) {}

  async listAsns(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.inboundAsn.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      include: {
        customer: true,
        warehouse: true,
        items: {
          include: {
            product: {
              include: {
                baseUom: true,
                uomConversions: { where: { isActive: true }, include: { fromUom: true, toUom: true } },
              },
            },
            supplier: true,
            uom: true,
          },
        },
        receipts: {
          orderBy: { receivedAt: 'desc' },
          take: 25,
          include: {
            product: { select: { id: true, sku: true, name: true } },
            bin: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createAsn(dto: CreateAsnDto, user?: JwtPayload) {
    this.assertWarehouseAllowed(user, dto.warehouseId);
    await this.assertCustomerWarehouseProductsAndSuppliers(
      dto.customerId,
      dto.warehouseId,
      dto.items.map((i) => ({ productId: i.productId, supplierId: i.supplierId })),
    );
    await this.assertUomsActive(dto.items.map((i) => i.uomId));
    const preparedItems = await Promise.all(
      dto.items.map((item) => this.prepareProductQtyForInbound(this.prisma, dto.customerId, item.productId, item.uomId, item.qtyExpected)),
    );
    try {
      return await this.prisma.inboundAsn.create({
        data: {
          asnNo: dto.asnNo.trim().toUpperCase(),
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          referenceNo: dto.referenceNo?.trim(),
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
          status: InboundAsnStatus.DRAFT,
          items: {
            create: dto.items.map((item, idx) => ({
              productId: item.productId,
              supplierId: item.supplierId,
              uomId: item.uomId,
              qtyExpected: new Prisma.Decimal(item.qtyExpected),
              qtyExpectedBase: preparedItems[idx].qtyBase,
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          items: { include: { product: true, supplier: true, uom: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('ASN number already exists');
      }
      throw err;
    }
  }

  async updateAsn(id: string, dto: UpdateAsnDto, user?: JwtPayload) {
    const asn = await this.prisma.inboundAsn.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!asn) throw new BadRequestException('ASN not found');
    this.assertWarehouseAllowed(user, asn.warehouseId);
    if (asn.status === InboundAsnStatus.COMPLETED && dto.status !== InboundAsnStatus.COMPLETED) {
      throw new BadRequestException('Completed ASN cannot be reopened');
    }

    return this.prisma.inboundAsn.update({
      where: { id },
      data: {
        referenceNo: dto.referenceNo?.trim(),
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        status: dto.status,
      },
      include: {
        customer: true,
        warehouse: true,
        items: { include: { product: true, supplier: true, uom: true } },
      },
    });
  }

  async updateAsnItems(id: string, dto: UpdateAsnItemsDto, user?: JwtPayload) {
    const asn = await this.prisma.inboundAsn.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true, customerId: true },
    });
    if (!asn) throw new BadRequestException('ASN not found');
    this.assertWarehouseAllowed(user, asn.warehouseId);
    if (asn.status !== InboundAsnStatus.DRAFT) {
      throw new BadRequestException('Only draft ASN can update items');
    }

    await this.assertCustomerWarehouseProductsAndSuppliers(
      asn.customerId,
      asn.warehouseId,
      dto.items.map((i) => ({ productId: i.productId, supplierId: i.supplierId })),
    );
    await this.assertUomsActive(dto.items.map((i) => i.uomId));
    const preparedItems = await Promise.all(
      dto.items.map((item) => this.prepareProductQtyForInbound(this.prisma, asn.customerId, item.productId, item.uomId, item.qtyExpected)),
    );

    const receiptCount = await this.prisma.inboundReceipt.count({
      where: { inboundAsnId: id },
    });
    if (receiptCount > 0) {
      throw new BadRequestException('ASN already has receiving records and cannot replace items');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inboundAsnItem.deleteMany({ where: { inboundAsnId: id } });
      await tx.inboundAsnItem.createMany({
        data: dto.items.map((item, idx) => ({
          inboundAsnId: id,
          productId: item.productId,
          supplierId: item.supplierId,
          uomId: item.uomId,
          qtyExpected: new Prisma.Decimal(item.qtyExpected),
          qtyReceived: new Prisma.Decimal(0),
          qtyExpectedBase: preparedItems[idx].qtyBase,
          qtyReceivedBase: new Prisma.Decimal(0),
        })),
      });
    });

    return this.prisma.inboundAsn.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        items: { include: { product: true, supplier: true, uom: true } },
      },
    });
  }

  async softDeleteAsn(id: string, user?: JwtPayload) {
    const asn = await this.prisma.inboundAsn.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!asn) throw new BadRequestException('ASN not found');
    this.assertWarehouseAllowed(user, asn.warehouseId);
    if (asn.status === InboundAsnStatus.COMPLETED) {
      throw new BadRequestException('Completed ASN cannot be cancelled');
    }

    await this.prisma.inboundAsn.update({
      where: { id },
      data: { status: InboundAsnStatus.CANCELLED },
    });
    return { success: true, mode: 'soft', id };
  }

  async releaseInboundReceiptCustoms(receiptId: string, dto: { releaseRef?: string }, user?: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.inboundReceipt.findUnique({
        where: { id: receiptId },
        select: {
          id: true,
          customerId: true,
          warehouseId: true,
          customsClearanceStatus: true,
          customsHoldStartedAt: true,
          receivedAt: true,
        },
      });
      if (!cur) {
        throw new NotFoundException('Inbound receipt not found');
      }
      this.assertWarehouseAllowed(user, cur.warehouseId);
      if (cur.customsClearanceStatus !== InboundReceiptCustomsClearanceStatus.HELD) {
        throw new BadRequestException('Only receipts in HELD customs status can be released');
      }
      const now = new Date();
      await tx.inboundReceipt.update({
        where: { id: receiptId },
        data: {
          customsClearanceStatus: InboundReceiptCustomsClearanceStatus.CLEARED,
          customsReleasedAt: now,
          customsReleaseRef: dto.releaseRef?.trim() ? dto.releaseRef.trim() : null,
        },
      });
      const holdStartedAt = cur.customsHoldStartedAt ?? cur.receivedAt;
      await this.createTransitCustomsReleaseBillingTx(tx, {
        receiptId: cur.id,
        customerId: cur.customerId,
        warehouseId: cur.warehouseId,
        holdStartedAt,
        releasedAt: now,
        operatorCompanyId: user?.operatorCompanyId,
      });
      return tx.inboundReceipt.findUnique({
        where: { id: receiptId },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
          inboundAsn: { select: { id: true, asnNo: true, warehouseId: true } },
        },
      });
    });
  }

  private periodKeyFromDateUtc(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private async createTransitCustomsReleaseBillingTx(
    tx: Prisma.TransactionClient,
    params: {
      receiptId: string;
      customerId: string;
      warehouseId: string;
      holdStartedAt: Date;
      releasedAt: Date;
      operatorCompanyId?: string | null;
    },
  ) {
    const dwellMs = params.releasedAt.getTime() - params.holdStartedAt.getTime();
    if (dwellMs <= 0) return;
    const dwellDays = new Prisma.Decimal(dwellMs).div(new Prisma.Decimal(86400000));
    const activeRate = await tx.billingRate.findFirst({
      where: {
        isActive: true,
        activityCode: InboundService.TRANSIT_CUSTOMS_DWELL_ACTIVITY_CODE,
        component: BillingComponent.STORAGE,
        contract: { customerId: params.customerId, isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      select: { rate: true },
    });
    const rate = activeRate?.rate ?? new Prisma.Decimal(0);
    const amount = dwellDays.mul(rate);
    await tx.billingTransaction.create({
      data: {
        customerId: params.customerId,
        warehouseId: params.warehouseId,
        operatorCompanyId: params.operatorCompanyId ?? null,
        component: BillingComponent.STORAGE,
        activityCode: InboundService.TRANSIT_CUSTOMS_DWELL_ACTIVITY_CODE,
        uom: 'DAY',
        qty: dwellDays,
        amount,
        referenceType: 'INBOUND_RECEIPT',
        referenceId: params.receiptId,
        periodKey: this.periodKeyFromDateUtc(params.releasedAt),
        status: BillingTransactionStatus.DRAFT,
        occurredAt: params.releasedAt,
        note: 'Transit customs dwell (hold → release); amount from STORAGE rate TRANSIT_CUSTOMS_DWELL_DAY if configured',
      },
    });
  }

  async receiveItem(dto: ReceiveAsnItemDto, user?: JwtPayload) {
    if (dto.qtyReceived <= 0) {
      throw new BadRequestException('qtyReceived must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const asn = await tx.inboundAsn.findUnique({
        where: { id: dto.inboundAsnId },
        include: { items: true },
      });
      if (!asn) throw new BadRequestException('ASN not found');
      this.assertWarehouseAllowed(user, asn.warehouseId);
      if (asn.status === InboundAsnStatus.CANCELLED || asn.status === InboundAsnStatus.COMPLETED) {
        throw new BadRequestException('ASN is not receivable');
      }

      const item = asn.items.find((i) => i.productId === dto.productId && i.supplierId === dto.supplierId);
      if (!item) throw new BadRequestException('Product and supplier are not part of ASN');

      const warehouse = await tx.warehouse.findUnique({
        where: { id: asn.warehouseId },
        select: { isTransitImportHub: true },
      });
      const transitHold = warehouse?.isTransitImportHub === true;
      const holdStartedAt = transitHold ? new Date() : null;

      const bin = await tx.warehouseBin.findUnique({
        where: { id: dto.binId },
        select: { id: true, warehouseId: true, isActive: true },
      });
      if (!bin || !bin.isActive || bin.warehouseId !== asn.warehouseId) {
        throw new BadRequestException('Bin not found/inactive or does not belong to ASN warehouse');
      }

      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, customerId: true, isActive: true },
      });
      if (!product || !product.isActive || product.customerId !== asn.customerId) {
        throw new BadRequestException('Product not found/inactive or does not belong to ASN customer');
      }

      await this.assertUniqueProductSerials(
        tx,
        asn.customerId,
        dto.productId,
        dto.serialNos,
      );

      const preparedReceived = await this.prepareProductQtyForInbound(tx, asn.customerId, dto.productId, dto.uomId ?? item.uomId, dto.qtyReceived);
      const qtyReceivedBase = preparedReceived.qtyBase;
      const nextQtyReceivedBase = new Prisma.Decimal(item.qtyReceivedBase).plus(qtyReceivedBase);
      if (nextQtyReceivedBase.greaterThan(item.qtyExpectedBase)) {
        throw new BadRequestException('Received quantity exceeds ASN expected quantity');
      }

      await tx.inventoryBalance.upsert({
        where: {
          customerId_warehouseId_binId_productId: {
            customerId: asn.customerId,
            warehouseId: asn.warehouseId,
            binId: dto.binId,
            productId: dto.productId,
          },
        },
        create: {
          customerId: asn.customerId,
          warehouseId: asn.warehouseId,
          binId: dto.binId,
          productId: dto.productId,
          qtyOnHand: qtyReceivedBase,
        },
        update: {
          qtyOnHand: { increment: qtyReceivedBase },
        },
      });

      await tx.inboundAsnItem.update({
        where: { id: item.id },
        data: { qtyReceived: nextQtyReceivedBase, qtyReceivedBase: nextQtyReceivedBase },
      });

      await tx.inboundReceipt.create({
        data: {
          inboundAsnId: asn.id,
          inboundItemId: item.id,
          customerId: asn.customerId,
          warehouseId: asn.warehouseId,
          productId: dto.productId,
          uomId: preparedReceived.uomId,
          binId: dto.binId,
          qtyReceived: qtyReceivedBase,
          qtyReceivedInput: preparedReceived.qtyInput,
          conversionFactor: preparedReceived.conversionFactor,
          lotNo: dto.lotNo?.trim() || undefined,
          batchNo: dto.batchNo?.trim() || undefined,
          serialNos: dto.serialNos && dto.serialNos.length > 0 ? dto.serialNos.map((s) => String(s).trim()).filter(Boolean) : undefined,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          note: dto.note?.trim(),
          customsClearanceStatus: transitHold
            ? InboundReceiptCustomsClearanceStatus.HELD
            : InboundReceiptCustomsClearanceStatus.NONE,
          customsHoldStartedAt: holdStartedAt,
        },
      });

      const refreshed = await tx.inboundAsn.findUnique({
        where: { id: asn.id },
        include: { items: true },
      });
      if (!refreshed) throw new BadRequestException('ASN not found after update');

      const allDone = refreshed.items.every((it) => new Prisma.Decimal(it.qtyReceivedBase).equals(it.qtyExpectedBase));
      await tx.inboundAsn.update({
        where: { id: asn.id },
        data: { status: allDone ? InboundAsnStatus.COMPLETED : InboundAsnStatus.RECEIVING },
      });

      return tx.inboundAsn.findUnique({
        where: { id: asn.id },
        include: {
          customer: true,
          warehouse: true,
          items: { include: { product: true, supplier: true, uom: true } },
          receipts: {
            orderBy: { receivedAt: 'desc' },
            take: 25,
            include: {
              product: { select: { id: true, sku: true, name: true } },
              bin: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
    });
  }

  private normalizeSerialNos(serialNos?: string[]): string[] {
    if (!Array.isArray(serialNos)) return [];
    const normalized = serialNos.map((s) => String(s).trim()).filter(Boolean);
    return [...new Set(normalized)];
  }

  private async assertUniqueProductSerials(
    tx: Prisma.TransactionClient,
    customerId: string,
    productId: string,
    serialNos?: string[],
  ) {
    const normalized = this.normalizeSerialNos(serialNos);
    if (normalized.length === 0) return;

    const values = Prisma.join(normalized.map((s) => Prisma.sql`${s}`));
    const duplicates = await tx.$queryRaw<Array<{ serialNo: string }>>`
      SELECT DISTINCT "serialNo" FROM (
        SELECT sns.sn AS "serialNo"
        FROM inbound_receipts ir
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ir.serial_nos, '[]'::jsonb)) AS sns(sn)
        WHERE ir.customer_id = ${customerId}
          AND ir.product_id = ${productId}
          AND sns.sn IN (${values})

        UNION

        SELECT sns.sn AS "serialNo"
        FROM material_transformations mt
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mt.output_serial_nos, '[]'::jsonb)) AS sns(sn)
        WHERE mt.customer_id = ${customerId}
          AND mt.output_product_id = ${productId}
          AND sns.sn IN (${values})

        UNION

        SELECT sns.sn AS "serialNo"
        FROM outbound_tasks ot
        JOIN sales_orders so ON so.id = ot.sales_order_id
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ot.serial_nos, '[]'::jsonb)) AS sns(sn)
        WHERE so.customer_id = ${customerId}
          AND ot.product_id = ${productId}
          AND ot.status = 'DONE'
          AND sns.sn IN (${values})
      ) d
    `;

    if (duplicates.length > 0) {
      const sample = duplicates.map((d) => d.serialNo).slice(0, 5).join(', ');
      throw new BadRequestException(`Serial already used for this customer/product: ${sample}`);
    }
  }

  private isSystemAdministrator(user?: JwtPayload): boolean {
    return Boolean(user?.roles?.includes('SYSTEM_ADMIN'));
  }

  private allowedWarehouseIds(user?: JwtPayload): string[] | undefined {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    return user.warehouseIds ?? [];
  }

  private assertWarehouseAllowed(user: JwtPayload | undefined, warehouseId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const allowed = new Set(user.warehouseIds ?? []);
    if (!allowed.has(warehouseId)) {
      throwScopeForbidden('FORBIDDEN_SCOPE_WAREHOUSE', 'User is not allowed to access this warehouse');
    }
  }

  private async assertCustomerWarehouseProductsAndSuppliers(
    customerId: string,
    warehouseId: string,
    itemRefs: Array<{ productId: string; supplierId: string }>,
  ) {
    const productIds = [...new Set(itemRefs.map((it) => it.productId))];
    const supplierIds = [...new Set(itemRefs.map((it) => it.supplierId))];

    const pairSet = new Set<string>();
    for (const item of itemRefs) {
      const key = `${item.productId}:${item.supplierId}`;
      if (pairSet.has(key)) {
        throw new BadRequestException('Duplicate product and supplier pair in ASN items');
      }
      pairSet.add(key);
    }

    await this.assertCustomerWarehouseAndProducts(customerId, warehouseId, productIds);

    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: supplierIds }, customerId, isActive: true },
      select: { id: true },
    });
    if (suppliers.length !== supplierIds.length) {
      throw new BadRequestException('One or more suppliers are invalid for this customer');
    }

    const mappings = await this.prisma.productSupplier.findMany({
      where: {
        productId: { in: productIds },
        supplierId: { in: supplierIds },
        isActive: true,
      },
      select: { productId: true, supplierId: true },
    });
    const mappingKeys = new Set(mappings.map((m) => `${m.productId}:${m.supplierId}`));
    const invalidPair = itemRefs.find((it) => !mappingKeys.has(`${it.productId}:${it.supplierId}`));
    if (invalidPair) {
      throw new BadRequestException('Supplier is not mapped for one or more selected products');
    }
  }

  private async assertCustomerWarehouseAndProducts(
    customerId: string,
    warehouseId: string,
    productIds: string[],
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, isActive: true, type: true, customerId: true },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }
    if (warehouse.type === WarehouseType.DEDICATED) {
      if (warehouse.customerId && warehouse.customerId !== customerId) {
        throw new BadRequestException('Warehouse is dedicated to different customer');
      }
    } else {
      const mappedCustomerIds = await this.prisma.$queryRaw<Array<{ customerId: string }>>`
        SELECT wc.customer_id AS "customerId"
        FROM warehouse_customers wc
        WHERE wc.warehouse_id = ${warehouseId}
          AND wc.is_active = true
      `;
      if (mappedCustomerIds.length === 0) return;
      const allowed = mappedCustomerIds.some((m) => m.customerId === customerId);
      if (!allowed) {
        throw new BadRequestException('Customer is not mapped to this shared warehouse');
      }
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] }, customerId, isActive: true },
      select: { id: true },
    });
    if (products.length !== [...new Set(productIds)].length) {
      throw new BadRequestException('One or more products are invalid for this customer');
    }
  }

  private async assertUomsActive(uomIds: string[]) {
    const uniqueIds = [...new Set(uomIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('ASN items must include UOM');
    }
    const count = await this.prisma.unitOfMeasure.count({
      where: {
        id: { in: uniqueIds },
        isActive: true,
      },
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException('One or more UOM are invalid or inactive');
    }
  }

  private async prepareProductQtyForInbound(
    db: PrismaService | Prisma.TransactionClient,
    customerId: string,
    productId: string,
    uomId: string | undefined,
    qty: number,
  ) {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, customerId: true, baseUomId: true },
    });
    if (!product || product.customerId !== customerId || !product.baseUomId) {
      throw new BadRequestException('Product base UOM is not configured');
    }
    const effectiveUomId = (uomId || product.baseUomId).trim();
    if (effectiveUomId === product.baseUomId) {
      return {
        uomId: product.baseUomId,
        qtyInput: new Prisma.Decimal(qty),
        conversionFactor: new Prisma.Decimal(1),
        qtyBase: new Prisma.Decimal(qty),
      };
    }
    const conversion = await db.productUomConversion.findFirst({
      where: {
        productId,
        fromUomId: effectiveUomId,
        toUomId: product.baseUomId,
        isActive: true,
      },
      select: { factor: true },
    });
    if (!conversion) {
      throw new BadRequestException('Missing active UOM conversion for selected product');
    }
    return {
      uomId: effectiveUomId,
      qtyInput: new Prisma.Decimal(qty),
      conversionFactor: conversion.factor,
      qtyBase: new Prisma.Decimal(qty).mul(conversion.factor),
    };
  }
}

