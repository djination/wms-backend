import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  BillingComponent,
  BillingTransactionStatus,
  InternalTransferStatus,
  MaterialTransformationStatus,
  OutboundTaskStatus,
  Prisma,
  WarehouseType,
} from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternalTransferDto } from './dto/create-internal-transfer.dto';
import { CreateMaterialTransformationDto } from './dto/create-material-transformation.dto';
import { CreateProcessRecipeDto } from './dto/create-process-recipe.dto';
import { CreateTransformationFromRecipeDto } from './dto/create-transformation-from-recipe.dto';
import { ProcessGenealogyQueryDto } from './dto/process-genealogy-query.dto';
import { UpdateProcessRecipeDto } from './dto/update-process-recipe.dto';

@Injectable()
export class ProcessFlowService {
  constructor(private readonly prisma: PrismaService) {}

  async listTransfers(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.internalTransfer.findMany({
      where: warehouseIds
        ? {
            OR: [{ fromWarehouseId: { in: warehouseIds } }, { toWarehouseId: { in: warehouseIds } }],
          }
        : undefined,
      include: {
        customer: true,
        fromWarehouse: true,
        toWarehouse: true,
        lines: { include: { product: true, sourceBin: true, destinationBin: true, uom: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createTransfer(dto: CreateInternalTransferDto, user?: JwtPayload) {
    if (dto.lines.length === 0) throw new BadRequestException('Transfer lines cannot be empty');
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('From warehouse and to warehouse cannot be the same');
    }
    this.assertWarehouseAllowed(user, dto.fromWarehouseId);
    this.assertWarehouseAllowed(user, dto.toWarehouseId);
    await this.assertCustomerWarehouseAndProducts(
      dto.customerId,
      [dto.fromWarehouseId, dto.toWarehouseId],
      dto.lines.map((l) => l.productId),
    );
    const preparedLines = await Promise.all(
      dto.lines.map((line) =>
        this.prepareTransferLine(dto.customerId, line.productId, line.uomId, line.qty),
      ),
    );

    try {
      const created = await this.prisma.internalTransfer.create({
        data: {
          transferNo: dto.transferNo.trim().toUpperCase(),
          customerId: dto.customerId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          note: dto.note?.trim(),
          lines: {
            create: dto.lines.map((line, idx) => ({
              productId: line.productId,
              sourceBinId: line.sourceBinId,
              destinationBinId: line.destinationBinId,
              qty: new Prisma.Decimal(line.qty),
              uomId: line.uomId,
              qtyBase: preparedLines[idx].qtyBase,
              conversionFactor: preparedLines[idx].conversionFactor,
            })),
          },
        },
        include: {
          customer: true,
          fromWarehouse: true,
          toWarehouse: true,
          lines: { include: { product: true, sourceBin: true, destinationBin: true, uom: true } },
        },
      });
      await this.recordProcessFlowEvent(this.prisma, {
        processType: 'TRANSFER',
        eventCode: 'TRANSFER_CREATED',
        customerId: created.customerId,
        warehouseId: created.fromWarehouseId,
        operatorCompanyId: user?.operatorCompanyId,
        internalTransferId: created.id,
        note: `Transfer ${created.transferNo} created`,
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Transfer number already exists');
      }
      throw err;
    }
  }

  async completeTransfer(id: string, user?: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.internalTransfer.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!transfer) throw new BadRequestException('Transfer not found');
      this.assertWarehouseAllowed(user, transfer.fromWarehouseId);
      this.assertWarehouseAllowed(user, transfer.toWarehouseId);
      if (transfer.status !== InternalTransferStatus.DRAFT) {
        throw new BadRequestException('Only draft transfer can be completed');
      }

      for (const line of transfer.lines) {
        const sourceBin = await tx.warehouseBin.findUnique({
          where: { id: line.sourceBinId },
          select: { warehouseId: true, isActive: true },
        });
        const destinationBin = await tx.warehouseBin.findUnique({
          where: { id: line.destinationBinId },
          select: { warehouseId: true, isActive: true },
        });
        if (!sourceBin || !sourceBin.isActive || sourceBin.warehouseId !== transfer.fromWarehouseId) {
          throw new BadRequestException('Invalid source bin for transfer line');
        }
        if (!destinationBin || !destinationBin.isActive || destinationBin.warehouseId !== transfer.toWarehouseId) {
          throw new BadRequestException('Invalid destination bin for transfer line');
        }

        const srcInv = await tx.inventoryBalance.findUnique({
          where: {
            customerId_warehouseId_binId_productId: {
              customerId: transfer.customerId,
              warehouseId: transfer.fromWarehouseId,
              binId: line.sourceBinId,
              productId: line.productId,
            },
          },
        });
        const qtyBase = line.qtyBase ?? line.qty;
        if (!srcInv || new Prisma.Decimal(srcInv.qtyOnHand).lessThan(qtyBase)) {
          throw new BadRequestException('Insufficient source inventory for transfer');
        }

        await tx.inventoryBalance.update({
          where: {
            customerId_warehouseId_binId_productId: {
              customerId: transfer.customerId,
              warehouseId: transfer.fromWarehouseId,
              binId: line.sourceBinId,
              productId: line.productId,
            },
          },
          data: { qtyOnHand: { decrement: qtyBase } },
        });

        await tx.inventoryBalance.upsert({
          where: {
            customerId_warehouseId_binId_productId: {
              customerId: transfer.customerId,
              warehouseId: transfer.toWarehouseId,
              binId: line.destinationBinId,
              productId: line.productId,
            },
          },
          create: {
            customerId: transfer.customerId,
            warehouseId: transfer.toWarehouseId,
            binId: line.destinationBinId,
            productId: line.productId,
            qtyOnHand: qtyBase,
          },
          update: {
            qtyOnHand: { increment: qtyBase },
          },
        });

        await this.createProcessFlowBillingTransaction(tx, {
          customerId: transfer.customerId,
          warehouseId: transfer.fromWarehouseId,
          operatorCompanyId: user?.operatorCompanyId,
          qty: qtyBase,
          activityCode: 'PROC_TRANSFER_QTY',
          referenceType: 'INTERNAL_TRANSFER',
          referenceId: transfer.id,
          occurredAt: new Date(),
          note: `Auto-generated from transfer ${transfer.transferNo} completion`,
        });
      }

      const completed = await tx.internalTransfer.update({
        where: { id: transfer.id },
        data: {
          status: InternalTransferStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          customer: true,
          fromWarehouse: true,
          toWarehouse: true,
          lines: { include: { product: true, sourceBin: true, destinationBin: true, uom: true } },
        },
      });
      await this.recordProcessFlowEvent(tx, {
        processType: 'TRANSFER',
        eventCode: 'TRANSFER_COMPLETED',
        customerId: transfer.customerId,
        warehouseId: transfer.fromWarehouseId,
        operatorCompanyId: user?.operatorCompanyId,
        internalTransferId: transfer.id,
        note: `Transfer ${transfer.transferNo} completed`,
      });
      return completed;
    });
  }

  async listTransformations(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.materialTransformation.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      include: {
        customer: true,
        warehouse: true,
        outputProduct: true,
        outputBin: true,
        outputUom: true,
        inputs: { include: { product: true, bin: true, uom: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async listEvents(user?: JwtPayload, processType?: string) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    const normalizedProcessType = processType?.trim().toUpperCase();
    return this.prisma.processFlowEventLog.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(normalizedProcessType ? { processType: normalizedProcessType } : {}),
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        operatorCompany: { select: { id: true, code: true, name: true } },
        internalTransfer: { select: { id: true, transferNo: true, status: true } },
        materialTransformation: { select: { id: true, processNo: true, status: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  }

  async genealogy(user: JwtPayload | undefined, query: ProcessGenealogyQueryDto) {
    const byId = query.transformationId?.trim();
    const byLot = query.outputLotNo?.trim();
    const byBatch = query.outputBatchNo?.trim();
    if (!byId && !byLot && !byBatch) {
      throw new BadRequestException('Provide at least one filter: transformationId, outputLotNo, or outputBatchNo');
    }

    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];

    const transforms = await this.prisma.materialTransformation.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(byId ? { id: byId } : {}),
        ...(byLot ? { outputLotNo: byLot } : {}),
        ...(byBatch ? { outputBatchNo: byBatch } : {}),
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        outputProduct: { select: { id: true, sku: true, name: true } },
        outputBin: { select: { id: true, code: true, name: true } },
        inputs: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            bin: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    if (transforms.length === 0) return [];

    const receiptWhereOr = transforms.flatMap((t) =>
      t.inputs
        .filter((i) => Boolean(i.lotNo || i.batchNo || i.serialNos))
        .map((i) => ({
          customerId: t.customerId,
          warehouseId: t.warehouseId,
          productId: i.productId,
          binId: i.binId,
          ...(i.lotNo ? { lotNo: i.lotNo } : {}),
          ...(i.batchNo ? { batchNo: i.batchNo } : {}),
        })),
    );

    const receipts =
      receiptWhereOr.length === 0
        ? []
        : await this.prisma.inboundReceipt.findMany({
            where: { OR: receiptWhereOr },
            include: {
              inboundAsn: { select: { id: true, asnNo: true } },
              product: { select: { id: true, sku: true, name: true } },
              uom: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ receivedAt: 'desc' }],
            take: 1000,
          });

    const outboundDoneTasks = await this.prisma.outboundTask.findMany({
      where: {
        status: OutboundTaskStatus.DONE,
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
      include: {
        salesOrder: { select: { id: true, orderNo: true, customerId: true, status: true } },
        wave: { select: { id: true, waveNo: true } },
      },
      orderBy: [{ completedAt: 'desc' }],
      take: 2000,
    });

    return transforms.map((t) => {
      const mappedInputs = t.inputs.map((i) => {
        const matchedReceipts = receipts.filter(
          (r) =>
            r.customerId === t.customerId &&
            r.warehouseId === t.warehouseId &&
            r.productId === i.productId &&
            r.binId === i.binId &&
            (i.lotNo ? r.lotNo === i.lotNo : true) &&
            (i.batchNo ? r.batchNo === i.batchNo : true) &&
            this.isSerialMatch(i.serialNos, r.serialNos),
        );
        return {
          id: i.id,
          product: i.product,
          bin: i.bin,
          qtyConsumed: i.qtyConsumed.toString(),
          lotNo: i.lotNo ?? null,
          batchNo: i.batchNo ?? null,
          serialNos: this.jsonToStringArray(i.serialNos),
          matchedInboundReceipts: matchedReceipts.map((r) => ({
            id: r.id,
            inboundAsnId: r.inboundAsnId,
            inboundAsnNo: r.inboundAsn?.asnNo ?? null,
            qtyReceived: r.qtyReceived.toString(),
            receivedAt: r.receivedAt,
            product: r.product,
            lotNo: r.lotNo ?? null,
            batchNo: r.batchNo ?? null,
            serialNos: this.jsonToStringArray(r.serialNos),
            expiryDate: r.expiryDate ?? null,
            uom: r.uom,
          })),
        };
      });

      return {
        id: t.id,
        processNo: t.processNo,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        customer: t.customer,
        warehouse: t.warehouse,
        output: {
          product: t.outputProduct,
          bin: t.outputBin,
          qtyOutput: t.qtyOutput.toString(),
          lotNo: t.outputLotNo ?? null,
          batchNo: t.outputBatchNo ?? null,
          serialNos: this.jsonToStringArray(t.outputSerialNos),
        },
        matchedOutboundTasks: outboundDoneTasks
          .filter(
            (ot) =>
              ot.productId === t.outputProductId &&
              ot.warehouseId === t.warehouseId &&
              ot.salesOrder.customerId === t.customerId &&
              this.isSerialMatch(t.outputSerialNos, ot.serialNos),
          )
          .map((ot) => ({
            id: ot.id,
            taskType: ot.taskType,
            status: ot.status,
            qtyTask: ot.qtyTask.toString(),
            qtyDone: ot.qtyDone.toString(),
            completedAt: ot.completedAt,
            serialNos: this.jsonToStringArray(ot.serialNos),
            salesOrder: { id: ot.salesOrder.id, orderNo: ot.salesOrder.orderNo, status: ot.salesOrder.status },
            wave: ot.wave ? { id: ot.wave.id, waveNo: ot.wave.waveNo } : null,
          })),
        inputs: mappedInputs,
      };
    });
  }

  /**
   * Finalize (post) all DRAFT billing lines generated from process flow (transfer / transformation),
   * scoped like other process-flow reads (warehouse + optional operator company).
   */
  async postDraftProcessFlowBilling(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) {
      return { postedCount: 0 };
    }
    const where: Prisma.BillingTransactionWhereInput = {
      status: BillingTransactionStatus.DRAFT,
      referenceType: { in: ['INTERNAL_TRANSFER', 'MATERIAL_TRANSFORMATION'] },
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      ...(user?.operatorCompanyId && !this.isSystemAdministrator(user)
        ? { operatorCompanyId: user.operatorCompanyId }
        : {}),
    };
    const result = await this.prisma.billingTransaction.updateMany({
      where,
      data: { status: BillingTransactionStatus.POSTED },
    });
    return { postedCount: result.count };
  }

  async billingSummary(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    const where: Prisma.BillingTransactionWhereInput = {
      referenceType: { in: ['INTERNAL_TRANSFER', 'MATERIAL_TRANSFORMATION'] },
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    };
    const rows = await this.prisma.billingTransaction.findMany({
      where,
      select: {
        component: true,
        activityCode: true,
        qty: true,
        amount: true,
        status: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 5000,
    });
    const byActivity: Record<
      string,
      {
        component: BillingComponent;
        activityCode: string;
        count: number;
        qty: Prisma.Decimal;
        amount: Prisma.Decimal;
      }
    > = {};
    for (const row of rows) {
      const key = `${row.component}:${row.activityCode}`;
      if (!byActivity[key]) {
        byActivity[key] = {
          component: row.component,
          activityCode: row.activityCode,
          count: 0,
          qty: new Prisma.Decimal(0),
          amount: new Prisma.Decimal(0),
        };
      }
      byActivity[key].count += 1;
      byActivity[key].qty = byActivity[key].qty.plus(row.qty);
      byActivity[key].amount = byActivity[key].amount.plus(row.amount);
    }
    const summaryRows = Object.values(byActivity).map((row) => ({
      component: row.component,
      activityCode: row.activityCode,
      count: row.count,
      qty: row.qty.toString(),
      amount: row.amount.toString(),
    }));
    const totalQty = rows.reduce((acc, row) => acc.plus(row.qty), new Prisma.Decimal(0));
    const totalAmount = rows.reduce((acc, row) => acc.plus(row.amount), new Prisma.Decimal(0));
    const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.status;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalTransactions: rows.length,
      totalQty: totalQty.toString(),
      totalAmount: totalAmount.toString(),
      byStatus,
      byActivity: summaryRows,
    };
  }

  async createTransformation(dto: CreateMaterialTransformationDto, user?: JwtPayload) {
    if (dto.inputs.length === 0) throw new BadRequestException('Transformation inputs cannot be empty');
    this.assertWarehouseAllowed(user, dto.warehouseId);
    await this.assertCustomerWarehouseAndProducts(
      dto.customerId,
      [dto.warehouseId],
      [dto.outputProductId, ...dto.inputs.map((i) => i.productId)],
    );
    await this.assertUniqueOutputSerials(dto.customerId, dto.outputProductId, dto.outputSerialNos);
    const outputQtyPrepared = await this.prepareProductQtyForProcess(
      dto.customerId,
      dto.outputProductId,
      dto.outputUomId,
      dto.qtyOutput,
    );
    const inputQtyPrepared = await Promise.all(
      dto.inputs.map((i) =>
        this.prepareProductQtyForProcess(dto.customerId, i.productId, i.uomId, i.qtyConsumed),
      ),
    );

    try {
      const created = await this.prisma.materialTransformation.create({
        data: {
          processNo: dto.processNo.trim().toUpperCase(),
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          outputProductId: dto.outputProductId,
          outputBinId: dto.outputBinId,
          outputLotNo: dto.outputLotNo?.trim() || undefined,
          outputBatchNo: dto.outputBatchNo?.trim() || undefined,
          outputSerialNos:
            dto.outputSerialNos && dto.outputSerialNos.length > 0
              ? dto.outputSerialNos.map((s) => String(s).trim()).filter(Boolean)
              : undefined,
          outputUomId: outputQtyPrepared.uomId,
          qtyOutputInput: outputQtyPrepared.qtyInput,
          outputConversionFactor: outputQtyPrepared.conversionFactor,
          qtyOutput: outputQtyPrepared.qtyBase,
          note: dto.note?.trim(),
          inputs: {
            create: dto.inputs.map((i, idx) => ({
              productId: i.productId,
              binId: i.binId,
              lotNo: i.lotNo?.trim() || undefined,
              batchNo: i.batchNo?.trim() || undefined,
              serialNos:
                i.serialNos && i.serialNos.length > 0
                  ? i.serialNos.map((s) => String(s).trim()).filter(Boolean)
                  : undefined,
              uomId: inputQtyPrepared[idx].uomId,
              qtyConsumedInput: inputQtyPrepared[idx].qtyInput,
              conversionFactor: inputQtyPrepared[idx].conversionFactor,
              qtyConsumed: inputQtyPrepared[idx].qtyBase,
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          outputProduct: true,
          outputBin: true,
          outputUom: true,
          inputs: { include: { product: true, bin: true, uom: true } },
        },
      });
      await this.recordProcessFlowEvent(this.prisma, {
        processType: 'TRANSFORMATION',
        eventCode: 'TRANSFORMATION_CREATED',
        customerId: created.customerId,
        warehouseId: created.warehouseId,
        operatorCompanyId: user?.operatorCompanyId,
        materialTransformationId: created.id,
        note: `Transformation ${created.processNo} created`,
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Process number already exists');
      }
      throw err;
    }
  }

  async completeTransformation(id: string, user?: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const process = await tx.materialTransformation.findUnique({
        where: { id },
        include: { inputs: true },
      });
      if (!process) throw new BadRequestException('Transformation not found');
      this.assertWarehouseAllowed(user, process.warehouseId);
      if (process.status !== MaterialTransformationStatus.DRAFT) {
        throw new BadRequestException('Only draft transformation can be completed');
      }

      const outBin = await tx.warehouseBin.findUnique({
        where: { id: process.outputBinId },
        select: { warehouseId: true, isActive: true },
      });
      if (!outBin || !outBin.isActive || outBin.warehouseId !== process.warehouseId) {
        throw new BadRequestException('Output bin not found/inactive or out of process warehouse');
      }

      for (const input of process.inputs) {
        const bin = await tx.warehouseBin.findUnique({
          where: { id: input.binId },
          select: { warehouseId: true, isActive: true },
        });
        if (!bin || !bin.isActive || bin.warehouseId !== process.warehouseId) {
          throw new BadRequestException('One or more input bins are invalid for process warehouse');
        }

        const stock = await tx.inventoryBalance.findUnique({
          where: {
            customerId_warehouseId_binId_productId: {
              customerId: process.customerId,
              warehouseId: process.warehouseId,
              binId: input.binId,
              productId: input.productId,
            },
          },
        });
        if (!stock || new Prisma.Decimal(stock.qtyOnHand).lessThan(input.qtyConsumed)) {
          throw new BadRequestException('Insufficient inventory for one or more transformation inputs');
        }

        await tx.inventoryBalance.update({
          where: {
            customerId_warehouseId_binId_productId: {
              customerId: process.customerId,
              warehouseId: process.warehouseId,
              binId: input.binId,
              productId: input.productId,
            },
          },
          data: { qtyOnHand: { decrement: input.qtyConsumed } },
        });
      }

      await tx.inventoryBalance.upsert({
        where: {
          customerId_warehouseId_binId_productId: {
            customerId: process.customerId,
            warehouseId: process.warehouseId,
            binId: process.outputBinId,
            productId: process.outputProductId,
          },
        },
        create: {
          customerId: process.customerId,
          warehouseId: process.warehouseId,
          binId: process.outputBinId,
          productId: process.outputProductId,
          qtyOnHand: process.qtyOutput,
        },
        update: {
          qtyOnHand: { increment: process.qtyOutput },
        },
      });

      await this.createProcessFlowBillingTransaction(tx, {
        customerId: process.customerId,
        warehouseId: process.warehouseId,
        operatorCompanyId: user?.operatorCompanyId,
        qty: process.qtyOutput,
        activityCode: 'PROC_TRANSFORM_OUT_QTY',
        referenceType: 'MATERIAL_TRANSFORMATION',
        referenceId: process.id,
        occurredAt: new Date(),
        note: `Auto-generated from transformation ${process.processNo} completion`,
      });

      const completed = await tx.materialTransformation.update({
        where: { id: process.id },
        data: {
          status: MaterialTransformationStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          customer: true,
          warehouse: true,
          outputProduct: true,
          outputBin: true,
          inputs: { include: { product: true, bin: true } },
        },
      });
      await this.recordProcessFlowEvent(tx, {
        processType: 'TRANSFORMATION',
        eventCode: 'TRANSFORMATION_COMPLETED',
        customerId: process.customerId,
        warehouseId: process.warehouseId,
        operatorCompanyId: user?.operatorCompanyId,
        materialTransformationId: process.id,
        note: `Transformation ${process.processNo} completed`,
      });
      return completed;
    });
  }

  async listRecipes(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    const customerIds = await this.allowedCustomerIdsByWarehouseScope(warehouseIds);
    if (customerIds.length === 0) return [];
    return this.prisma.processRecipe.findMany({
      where: { customerId: { in: customerIds } },
      include: {
        customer: true,
        outputProduct: true,
        lines: { include: { product: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async createRecipe(dto: CreateProcessRecipeDto, user?: JwtPayload) {
    if (dto.lines.length === 0) throw new BadRequestException('Recipe lines cannot be empty');
    this.assertNoDuplicateRecipeProducts(dto.lines.map((line) => line.productId));
    await this.assertCustomerWarehouseAndProducts(dto.customerId, [], [dto.outputProductId, ...dto.lines.map((l) => l.productId)]);
    try {
      return await this.prisma.processRecipe.create({
        data: {
          recipeCode: dto.recipeCode.trim().toUpperCase(),
          customerId: dto.customerId,
          outputProductId: dto.outputProductId,
          baseOutputQty: new Prisma.Decimal(dto.baseOutputQty),
          note: dto.note?.trim(),
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              qtyPerBase: new Prisma.Decimal(line.qtyPerBase),
            })),
          },
        },
        include: {
          customer: true,
          outputProduct: true,
          lines: { include: { product: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Recipe code already exists for this customer');
      }
      throw err;
    }
  }

  async updateRecipe(id: string, dto: UpdateProcessRecipeDto, user?: JwtPayload) {
    const existing = await this.prisma.processRecipe.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) throw new BadRequestException('Recipe not found');
    const allowedCustomerIds = await this.allowedCustomerIdsByWarehouseScope(this.allowedWarehouseIds(user));
    if (allowedCustomerIds.length > 0 && !allowedCustomerIds.includes(existing.customerId) && !this.isSystemAdministrator(user)) {
      throw new BadRequestException('User is not allowed to access this recipe');
    }

    const nextOutputProductId = dto.outputProductId ?? existing.outputProductId;
    const nextLines = dto.lines ?? existing.lines.map((line) => ({ productId: line.productId, qtyPerBase: Number(line.qtyPerBase) }));
    this.assertNoDuplicateRecipeProducts(nextLines.map((line) => line.productId));
    await this.assertCustomerWarehouseAndProducts(existing.customerId, [], [nextOutputProductId, ...nextLines.map((l) => l.productId)]);
    if (dto.isActive === false) {
      const draftUsageCount = await this.prisma.materialTransformation.count({
        where: {
          recipeId: id,
          status: MaterialTransformationStatus.DRAFT,
        },
      });
      if (draftUsageCount > 0) {
        throw new BadRequestException('Recipe cannot be deactivated because it is used by draft transformations');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.processRecipe.update({
        where: { id },
        data: {
          recipeCode: dto.recipeCode?.trim().toUpperCase(),
          outputProductId: dto.outputProductId,
          baseOutputQty: dto.baseOutputQty !== undefined ? new Prisma.Decimal(dto.baseOutputQty) : undefined,
          note: dto.note?.trim(),
          isActive: dto.isActive,
        },
      });
      if (dto.lines) {
        await tx.processRecipeLine.deleteMany({ where: { recipeId: id } });
        await tx.processRecipeLine.createMany({
          data: dto.lines.map((line) => ({
            recipeId: id,
            productId: line.productId,
            qtyPerBase: new Prisma.Decimal(line.qtyPerBase),
          })),
        });
      }

      return tx.processRecipe.findUnique({
        where: { id: updated.id },
        include: {
          customer: true,
          outputProduct: true,
          lines: { include: { product: true } },
        },
      });
    });
  }

  async createTransformationFromRecipe(dto: CreateTransformationFromRecipeDto, user?: JwtPayload) {
    this.assertWarehouseAllowed(user, dto.warehouseId);
    const recipe = await this.prisma.processRecipe.findUnique({
      where: { id: dto.recipeId },
      include: { lines: true },
    });
    if (!recipe || !recipe.isActive) {
      throw new BadRequestException('Recipe not found or inactive');
    }
    if (recipe.lines.length === 0) throw new BadRequestException('Recipe has no lines');

    const inputBinMap = new Map(dto.inputBins.map((b) => [b.productId, b]));
    const missingBinProduct = recipe.lines.find((line) => !inputBinMap.has(line.productId));
    if (missingBinProduct) {
      throw new BadRequestException('Input bin mapping is required for all recipe materials');
    }

    await this.assertCustomerWarehouseAndProducts(
      recipe.customerId,
      [dto.warehouseId],
      [recipe.outputProductId, ...recipe.lines.map((l) => l.productId)],
    );
    await this.assertUniqueOutputSerials(recipe.customerId, recipe.outputProductId, dto.outputSerialNos);
    const outputQtyPrepared = await this.prepareProductQtyForProcess(
      recipe.customerId,
      recipe.outputProductId,
      dto.outputUomId,
      dto.qtyOutput,
    );

    const factor = new Prisma.Decimal(dto.qtyOutput).div(recipe.baseOutputQty);
    const computedInputs = await Promise.all(
      recipe.lines.map(async (line) => {
        const consumedQty = new Prisma.Decimal(line.qtyPerBase).mul(factor);
        const prepared = await this.prepareProductQtyForProcess(
          recipe.customerId,
          line.productId,
          undefined,
          Number(consumedQty),
        );
        return {
          productId: line.productId,
          binId: inputBinMap.get(line.productId)!.binId,
          lotNo: inputBinMap.get(line.productId)?.lotNo?.trim() || undefined,
          batchNo: inputBinMap.get(line.productId)?.batchNo?.trim() || undefined,
          serialNos:
            inputBinMap.get(line.productId)?.serialNos && inputBinMap.get(line.productId)!.serialNos!.length > 0
              ? inputBinMap
                  .get(line.productId)!
                  .serialNos!.map((s) => String(s).trim())
                  .filter(Boolean)
              : undefined,
          uomId: prepared.uomId,
          qtyConsumedInput: prepared.qtyInput,
          conversionFactor: prepared.conversionFactor,
          qtyConsumed: prepared.qtyBase,
        };
      }),
    );

    try {
      const created = await this.prisma.materialTransformation.create({
        data: {
          processNo: dto.processNo.trim().toUpperCase(),
          customerId: recipe.customerId,
          warehouseId: dto.warehouseId,
          outputProductId: recipe.outputProductId,
          outputBinId: dto.outputBinId,
          outputLotNo: dto.outputLotNo?.trim() || undefined,
          outputBatchNo: dto.outputBatchNo?.trim() || undefined,
          outputSerialNos:
            dto.outputSerialNos && dto.outputSerialNos.length > 0
              ? dto.outputSerialNos.map((s) => String(s).trim()).filter(Boolean)
              : undefined,
          recipeId: recipe.id,
          outputUomId: outputQtyPrepared.uomId,
          qtyOutputInput: outputQtyPrepared.qtyInput,
          outputConversionFactor: outputQtyPrepared.conversionFactor,
          qtyOutput: outputQtyPrepared.qtyBase,
          note: dto.note?.trim(),
          inputs: {
            create: computedInputs.map((i) => ({
              productId: i.productId,
              binId: i.binId,
              lotNo: i.lotNo,
              batchNo: i.batchNo,
              serialNos: i.serialNos,
              uomId: i.uomId,
              qtyConsumedInput: i.qtyConsumedInput,
              conversionFactor: i.conversionFactor,
              qtyConsumed: i.qtyConsumed,
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          outputProduct: true,
          outputBin: true,
          outputUom: true,
          recipe: { include: { lines: true } },
          inputs: { include: { product: true, bin: true, uom: true } },
        },
      });
      await this.recordProcessFlowEvent(this.prisma, {
        processType: 'TRANSFORMATION',
        eventCode: 'TRANSFORMATION_CREATED_FROM_RECIPE',
        customerId: created.customerId,
        warehouseId: created.warehouseId,
        operatorCompanyId: user?.operatorCompanyId,
        materialTransformationId: created.id,
        note: `Transformation ${created.processNo} created from recipe`,
        metadata: { recipeId: created.recipeId ?? null },
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Process number already exists');
      }
      throw err;
    }
  }

  private async prepareTransferLine(customerId: string, productId: string, uomId: string, qty: number) {
    return this.prepareProductQtyForProcess(customerId, productId, uomId, qty);
  }

  private async prepareProductQtyForProcess(customerId: string, productId: string, uomId: string | undefined, qty: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, customerId: true, baseUomId: true },
    });
    if (!product || product.customerId !== customerId) {
      throw new BadRequestException('Product is invalid for transfer customer');
    }
    if (!product.baseUomId) {
      throw new BadRequestException('Product base UOM is not configured');
    }
    const effectiveUomId = uomId?.trim() || product.baseUomId;
    if (effectiveUomId === product.baseUomId) {
      return {
        uomId: product.baseUomId,
        qtyInput: new Prisma.Decimal(qty),
        conversionFactor: new Prisma.Decimal(1),
        qtyBase: new Prisma.Decimal(qty),
      };
    }

    const conversion = await this.prisma.productUomConversion.findFirst({
      where: {
        productId,
        fromUomId: effectiveUomId,
        toUomId: product.baseUomId,
        isActive: true,
      },
      select: { factor: true },
    });
    if (!conversion) {
      throw new BadRequestException('Missing active UOM conversion for selected product line');
    }
    const qtyBase = new Prisma.Decimal(qty).mul(conversion.factor);
    return {
      uomId: effectiveUomId,
      qtyInput: new Prisma.Decimal(qty),
      conversionFactor: conversion.factor,
      qtyBase,
    };
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

  private async assertCustomerWarehouseAndProducts(customerId: string, warehouseIds: string[], productIds: string[]) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }

    for (const warehouseId of [...new Set(warehouseIds)]) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, isActive: true, type: true, customerId: true },
      });
      if (!warehouse || !warehouse.isActive) {
        throw new BadRequestException('Warehouse not found or inactive');
      }
      if (warehouse.type === WarehouseType.DEDICATED && warehouse.customerId && warehouse.customerId !== customerId) {
        throw new BadRequestException('Warehouse is dedicated to different customer');
      }
      if (warehouse.type === WarehouseType.SHARED) {
        const mapped = await this.prisma.$queryRaw<Array<{ customerId: string }>>`
          SELECT wc.customer_id AS "customerId"
          FROM warehouse_customers wc
          WHERE wc.warehouse_id = ${warehouseId}
            AND wc.is_active = true
        `;
        if (mapped.length > 0 && !mapped.some((m) => m.customerId === customerId)) {
          throw new BadRequestException('Customer is not mapped to one or more selected warehouses');
        }
      }
    }

    const uniqProducts = [...new Set(productIds)];
    const validProducts = await this.prisma.product.findMany({
      where: { id: { in: uniqProducts }, customerId, isActive: true },
      select: { id: true },
    });
    if (validProducts.length !== uniqProducts.length) {
      throw new BadRequestException('One or more products are invalid for this customer');
    }
  }

  private async allowedCustomerIdsByWarehouseScope(warehouseIds?: string[]): Promise<string[]> {
    if (!warehouseIds) {
      const rows = await this.prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    const dedicatedRows = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { customerId: true },
    });
    const dedicatedCustomerIds = dedicatedRows.map((r) => r.customerId).filter((id): id is string => Boolean(id));

    const mappedRows = warehouseIds.length
      ? await this.prisma.$queryRaw<Array<{ customerId: string }>>`
          SELECT wc.customer_id AS "customerId"
          FROM warehouse_customers wc
          WHERE wc.warehouse_id IN (${Prisma.join(warehouseIds)})
            AND wc.is_active = true
        `
      : [];
    const mappedCustomerIds = mappedRows.map((r) => r.customerId);
    return [...new Set([...dedicatedCustomerIds, ...mappedCustomerIds])];
  }

  private assertNoDuplicateRecipeProducts(productIds: string[]) {
    const normalized = productIds.filter(Boolean);
    const unique = new Set(normalized);
    if (unique.size !== normalized.length) {
      throw new BadRequestException('Duplicate product in recipe lines is not allowed');
    }
  }

  private periodKeyFromDate(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private jsonToStringArray(value: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v)).filter((v) => v.trim().length > 0);
  }

  private isSerialMatch(inputSerialsRaw: Prisma.JsonValue | null | undefined, receiptSerialsRaw: Prisma.JsonValue | null | undefined): boolean {
    const inputSerials = this.jsonToStringArray(inputSerialsRaw);
    if (inputSerials.length === 0) return true;
    const receiptSerials = new Set(this.jsonToStringArray(receiptSerialsRaw));
    return inputSerials.every((sn) => receiptSerials.has(sn));
  }

  private normalizeSerialNos(serialNos?: string[]): string[] {
    if (!Array.isArray(serialNos)) return [];
    const normalized = serialNos.map((s) => String(s).trim()).filter(Boolean);
    return [...new Set(normalized)];
  }

  private async assertUniqueOutputSerials(customerId: string, productId: string, serialNos?: string[]) {
    const normalized = this.normalizeSerialNos(serialNos);
    if (normalized.length === 0) return;
    const values = Prisma.join(normalized.map((s) => Prisma.sql`${s}`));
    const duplicates = await this.prisma.$queryRaw<Array<{ serialNo: string }>>`
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
      throw new BadRequestException(`Output serial already used for this customer/product: ${sample}`);
    }
  }

  private async createProcessFlowBillingTransaction(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      warehouseId: string;
      operatorCompanyId?: string | null;
      qty: Prisma.Decimal;
      activityCode: string;
      referenceType: string;
      referenceId: string;
      occurredAt?: Date;
      note?: string;
    },
  ) {
    const occurredAt = params.occurredAt ?? new Date();
    const activeRate = await tx.billingRate.findFirst({
      where: {
        isActive: true,
        activityCode: params.activityCode,
        component: BillingComponent.HANDLING,
        contract: { customerId: params.customerId, isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      select: { rate: true },
    });
    const rate = activeRate?.rate ?? new Prisma.Decimal(0);
    const amount = new Prisma.Decimal(params.qty).mul(rate);

    await tx.billingTransaction.create({
      data: {
        customerId: params.customerId,
        warehouseId: params.warehouseId,
        operatorCompanyId: params.operatorCompanyId,
        component: BillingComponent.HANDLING,
        activityCode: params.activityCode,
        uom: 'QTY',
        qty: params.qty,
        amount,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        periodKey: this.periodKeyFromDate(occurredAt),
        status: BillingTransactionStatus.DRAFT,
        occurredAt,
        note: params.note,
      },
    });
  }

  private async recordProcessFlowEvent(
    tx: Prisma.TransactionClient | PrismaService,
    params: {
      processType: 'TRANSFER' | 'TRANSFORMATION';
      eventCode: string;
      customerId: string;
      warehouseId: string;
      operatorCompanyId?: string | null;
      internalTransferId?: string;
      materialTransformationId?: string;
      note?: string;
      metadata?: Prisma.JsonObject;
    },
  ) {
    await tx.processFlowEventLog.create({
      data: {
        processType: params.processType,
        eventCode: params.eventCode,
        customerId: params.customerId,
        warehouseId: params.warehouseId,
        operatorCompanyId: params.operatorCompanyId,
        internalTransferId: params.internalTransferId,
        materialTransformationId: params.materialTransformationId,
        note: params.note,
        metadata: params.metadata,
      },
    });
  }
}

