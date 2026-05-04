import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingComponent,
  BillingTransactionStatus,
  OutboundSerialReservationStatus,
  OutboundTaskStatus,
  OutboundTaskType,
  Prisma,
  SalesOrderStatus,
  WarehouseType,
} from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import {
  effectiveQtyOnHandAfterCustomsHold,
  mapInboundCustomsHeldQtyByBin,
  sumInboundCustomsHeldQtyBase,
} from '../../common/inventory/transit-customs-available.util';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CompleteOutboundTaskDto } from './dto/complete-outbound-task.dto';
import { CreateOutboundTaskDto } from './dto/create-outbound-task.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { CreateWaveDto } from './dto/create-wave.dto';
import { UpdateOutboundTaskDto } from './dto/update-outbound-task.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { UpdateSalesOrderItemsDto } from './dto/update-sales-order-items.dto';
import { UpdateWaveDto } from './dto/update-wave.dto';

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private static readonly ALLOWED_STATUS_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
    DRAFT: [SalesOrderStatus.RELEASED, SalesOrderStatus.CANCELLED],
    RELEASED: [SalesOrderStatus.ALLOCATED, SalesOrderStatus.PICKING, SalesOrderStatus.CANCELLED],
    ALLOCATED: [SalesOrderStatus.PICKING, SalesOrderStatus.CANCELLED],
    PICKING: [SalesOrderStatus.PACKING, SalesOrderStatus.CANCELLED],
    PACKING: [SalesOrderStatus.LOADING, SalesOrderStatus.CANCELLED],
    LOADING: [SalesOrderStatus.SHIPPED, SalesOrderStatus.CANCELLED],
    SHIPPED: [],
    CANCELLED: [],
  };

  async listSalesOrders(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.salesOrder.findMany({
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
          },
        },
        tasks: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createSalesOrder(dto: CreateSalesOrderDto, user?: JwtPayload) {
    this.assertWarehouseAllowed(user, dto.warehouseId);
    await this.assertCustomerWarehouseAndProducts(dto.customerId, dto.warehouseId, dto.items.map((i) => i.productId));
    try {
      const created = await this.prisma.salesOrder.create({
        data: {
          orderNo: dto.orderNo.trim().toUpperCase(),
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          consigneeName: dto.consigneeName?.trim(),
          referenceNo: dto.referenceNo?.trim(),
          requestedAt: dto.requestedAt ? new Date(dto.requestedAt) : undefined,
          status: SalesOrderStatus.RELEASED,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              qtyOrdered: new Prisma.Decimal(item.qtyOrdered),
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          items: { include: { product: true } },
        },
      });
      await this.recordOutboundEvent(this.prisma, {
        salesOrderId: created.id,
        warehouseId: created.warehouseId,
        customerId: created.customerId,
        operatorCompanyId: user?.operatorCompanyId,
        eventCode: 'ORDER_RELEASED',
        note: 'Sales order created and released',
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Sales order number already exists');
      }
      throw err;
    }
  }

  async updateSalesOrder(id: string, dto: UpdateSalesOrderDto, user?: JwtPayload) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!order) throw new BadRequestException('Sales order not found');
    this.assertWarehouseAllowed(user, order.warehouseId);
    if (dto.status) {
      this.assertAllowedStatusTransition(order.status, dto.status);
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        consigneeName: dto.consigneeName?.trim(),
        referenceNo: dto.referenceNo?.trim(),
        requestedAt: dto.requestedAt ? new Date(dto.requestedAt) : undefined,
        status: dto.status,
      },
      include: {
        customer: true,
        warehouse: true,
        items: { include: { product: true } },
      },
    });
    if (dto.status && dto.status !== order.status) {
      await this.recordOutboundEvent(this.prisma, {
        salesOrderId: updated.id,
        warehouseId: updated.warehouseId,
        customerId: updated.customerId,
        operatorCompanyId: user?.operatorCompanyId,
        outboundTaskId: null,
        eventCode: 'ORDER_STATUS_UPDATED',
        metadata: { fromStatus: order.status, toStatus: dto.status },
      });
    }
    return updated;
  }

  async updateSalesOrderItems(id: string, dto: UpdateSalesOrderItemsDto, user?: JwtPayload) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true, customerId: true },
    });
    if (!order) throw new BadRequestException('Sales order not found');
    this.assertWarehouseAllowed(user, order.warehouseId);
    if (order.status !== SalesOrderStatus.DRAFT && order.status !== SalesOrderStatus.RELEASED) {
      throw new BadRequestException('Only draft/released sales order can update items');
    }

    const activeTaskCount = await this.prisma.outboundTask.count({
      where: {
        salesOrderId: id,
        status: { in: [OutboundTaskStatus.OPEN, OutboundTaskStatus.IN_PROGRESS, OutboundTaskStatus.DONE] },
      },
    });
    if (activeTaskCount > 0) {
      throw new BadRequestException('Sales order already has outbound tasks and cannot replace items');
    }

    await this.assertCustomerWarehouseAndProducts(order.customerId, order.warehouseId, dto.items.map((i) => i.productId));

    await this.prisma.$transaction(async (tx) => {
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
      await tx.salesOrderItem.createMany({
        data: dto.items.map((item) => ({
          salesOrderId: id,
          productId: item.productId,
          qtyOrdered: new Prisma.Decimal(item.qtyOrdered),
          qtyPicked: new Prisma.Decimal(0),
          qtyPacked: new Prisma.Decimal(0),
          qtyShipped: new Prisma.Decimal(0),
        })),
      });
    });

    return this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        items: { include: { product: true } },
      },
    });
  }

  async softDeleteSalesOrder(id: string, user?: JwtPayload) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!order) throw new BadRequestException('Sales order not found');
    this.assertWarehouseAllowed(user, order.warehouseId);
    if (order.status === SalesOrderStatus.SHIPPED) {
      throw new BadRequestException('Shipped sales order cannot be cancelled');
    }

    await this.prisma.$transaction([
      this.prisma.outboundTask.updateMany({
        where: {
          salesOrderId: id,
          status: { in: [OutboundTaskStatus.OPEN, OutboundTaskStatus.IN_PROGRESS] },
        },
        data: { status: OutboundTaskStatus.CANCELLED, completedAt: null },
      }),
      this.prisma.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CANCELLED },
      }),
    ]);
    return { success: true, mode: 'soft', id };
  }

  async listWaves(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.outboundWave.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      include: { salesOrder: true, warehouse: true },
    });
  }

  async createWave(dto: CreateWaveDto, user?: JwtPayload) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: dto.salesOrderId },
      select: { id: true, warehouseId: true, customerId: true, status: true },
    });
    if (!order) throw new BadRequestException('Sales order not found');
    this.assertWarehouseAllowed(user, order.warehouseId);
    if (order.status === SalesOrderStatus.CANCELLED || order.status === SalesOrderStatus.SHIPPED) {
      throw new BadRequestException('Sales order is not eligible for wave planning');
    }

    try {
      const created = await this.prisma.outboundWave.create({
        data: {
          waveNo: dto.waveNo.trim().toUpperCase(),
          salesOrderId: dto.salesOrderId,
          warehouseId: order.warehouseId,
          plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : undefined,
        },
        include: { salesOrder: true, warehouse: true },
      });
      await this.prisma.salesOrder.update({
        where: { id: dto.salesOrderId },
        data: { status: order.status === SalesOrderStatus.RELEASED ? SalesOrderStatus.ALLOCATED : order.status },
      });
      const serialReservation = await this.reserveSerialsForSalesOrder(this.prisma, {
        salesOrderId: created.salesOrderId,
        waveId: created.id,
        operatorCompanyId: user?.operatorCompanyId,
      });
      await this.recordOutboundEvent(this.prisma, {
        salesOrderId: dto.salesOrderId,
        warehouseId: order.warehouseId,
        customerId: created.salesOrder.customerId,
        operatorCompanyId: user?.operatorCompanyId,
        eventCode: 'WAVE_CREATED',
        note: `Wave ${created.waveNo} created`,
        metadata: {
          waveId: created.id,
          waveNo: created.waveNo,
          serialReservation: {
            reservedCount: serialReservation.reservedCount,
            targetedCount: serialReservation.targetedCount,
            unresolvedCount: serialReservation.unresolvedCount,
          },
        },
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Wave number already exists');
      }
      throw err;
    }
  }

  async updateWave(id: string, dto: UpdateWaveDto, user?: JwtPayload) {
    const wave = await this.prisma.outboundWave.findUnique({
      where: { id },
      select: { id: true, warehouseId: true },
    });
    if (!wave) throw new BadRequestException('Wave not found');
    this.assertWarehouseAllowed(user, wave.warehouseId);

    return this.prisma.outboundWave.update({
      where: { id },
      data: {
        plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : undefined,
      },
      include: { salesOrder: true, warehouse: true },
    });
  }

  async listTasks(user?: JwtPayload, salesOrderId?: string, status?: string) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.outboundTask.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(salesOrderId ? { salesOrderId } : {}),
        ...(status ? { status: this.parseTaskStatus(status) } : {}),
      },
      include: {
        salesOrder: true,
        salesOrderItem: { include: { product: true } },
        wave: true,
        warehouse: true,
        uom: true,
        sourceBin: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async listEvents(user?: JwtPayload, salesOrderId?: string, outboundTaskId?: string, eventCode?: string) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.outboundEventLog.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(salesOrderId ? { salesOrderId } : {}),
        ...(outboundTaskId ? { outboundTaskId } : {}),
        ...(eventCode ? { eventCode: eventCode.trim().toUpperCase() } : {}),
      },
      include: {
        salesOrder: { select: { id: true, orderNo: true, status: true } },
        outboundTask: { select: { id: true, taskType: true, status: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        customer: { select: { id: true, code: true, name: true } },
        operatorCompany: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async listSerialReservations(user?: JwtPayload, salesOrderId?: string, waveId?: string, status?: string) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.outboundSerialReservation.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(salesOrderId ? { salesOrderId } : {}),
        ...(waveId ? { waveId } : {}),
        ...(status ? { status: this.parseSerialReservationStatus(status) } : {}),
      },
      include: {
        salesOrder: { select: { id: true, orderNo: true, status: true } },
        salesOrderItem: { select: { id: true, qtyOrdered: true } },
        wave: { select: { id: true, waveNo: true, plannedAt: true } },
        outboundTask: { select: { id: true, taskType: true, status: true } },
        product: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ reservedAt: 'desc' }],
      take: 500,
    });
  }

  async listAllocations(user?: JwtPayload, salesOrderId?: string) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.outboundAllocation.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(salesOrderId ? { salesOrderId } : {}),
      },
      include: {
        salesOrder: { select: { id: true, orderNo: true, status: true } },
        salesOrderItem: { select: { id: true, qtyOrdered: true, qtyPicked: true, qtyPacked: true, qtyShipped: true } },
        product: { select: { id: true, sku: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
  }

  async allocateSalesOrder(id: string, user?: JwtPayload) {
    return this.allocateSalesOrderInternal(id, false, user);
  }

  async reallocateSalesOrder(id: string, user?: JwtPayload) {
    return this.allocateSalesOrderInternal(id, true, user);
  }

  async createTask(dto: CreateOutboundTaskDto, user?: JwtPayload) {
    if (dto.qtyTask <= 0) throw new BadRequestException('qtyTask must be greater than zero');
    const normalizedPlanSerials = this.normalizeSerialNos(dto.serialNos);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: dto.salesOrderId },
        select: { id: true, warehouseId: true, customerId: true, status: true },
      });
      if (!order) throw new BadRequestException('Sales order not found');
      this.assertWarehouseAllowed(user, order.warehouseId);
      if (order.status === SalesOrderStatus.CANCELLED || order.status === SalesOrderStatus.SHIPPED) {
        throw new BadRequestException('Sales order is not eligible for new task');
      }

      const item = await tx.salesOrderItem.findUnique({
        where: { id: dto.salesOrderItemId },
        select: { id: true, salesOrderId: true, productId: true },
      });
      if (!item || item.salesOrderId !== dto.salesOrderId) {
        throw new BadRequestException('Sales order item is invalid');
      }
      const preparedTaskQty = await this.prepareProductQtyForOutbound(
        tx,
        order.customerId,
        item.productId,
        dto.uomId,
        dto.qtyTask,
      );
      if (normalizedPlanSerials.length > 0 && new Prisma.Decimal(normalizedPlanSerials.length).greaterThan(preparedTaskQty.qtyBase)) {
        throw new BadRequestException('Serial count cannot exceed qtyTask');
      }
      await this.assertReservableProductSerials(
        tx,
        order.customerId,
        item.productId,
        normalizedPlanSerials,
        dto.salesOrderId,
        dto.salesOrderItemId,
      );

      if (dto.waveId) {
        const wave = await tx.outboundWave.findUnique({
          where: { id: dto.waveId },
          select: { id: true, salesOrderId: true },
        });
        if (!wave || wave.salesOrderId !== dto.salesOrderId) {
          throw new BadRequestException('Wave is invalid for selected sales order');
        }
      }

      if (dto.sourceBinId) {
        const bin = await tx.warehouseBin.findUnique({
          where: { id: dto.sourceBinId },
          select: { id: true, warehouseId: true, isActive: true },
        });
        if (!bin || !bin.isActive || bin.warehouseId !== order.warehouseId) {
          throw new BadRequestException('Source bin not found/inactive or out of order warehouse');
        }
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            customerId_warehouseId_binId_productId: {
              customerId: order.customerId,
              warehouseId: order.warehouseId,
              binId: dto.sourceBinId,
              productId: item.productId,
            },
          },
        });
        const onHand = balance ? new Prisma.Decimal(balance.qtyOnHand) : new Prisma.Decimal(0);
        const held = await sumInboundCustomsHeldQtyBase(tx, {
          customerId: order.customerId,
          warehouseId: order.warehouseId,
          binId: dto.sourceBinId,
          productId: item.productId,
        });
        const available = effectiveQtyOnHandAfterCustomsHold(onHand, held);
        if (available.lessThan(preparedTaskQty.qtyBase)) {
          throw new BadRequestException(
            'Insufficient available inventory at source bin for task quantity (inbound customs HELD reduces available qty in transit warehouse)',
          );
        }
      }

      const task = await tx.outboundTask.create({
        data: {
          salesOrderId: dto.salesOrderId,
          salesOrderItemId: dto.salesOrderItemId,
          waveId: dto.waveId,
          warehouseId: order.warehouseId,
          productId: item.productId,
          sourceBinId: dto.sourceBinId,
          taskType: dto.taskType,
          qtyTask: preparedTaskQty.qtyBase,
          uomId: preparedTaskQty.uomId,
          qtyTaskInput: preparedTaskQty.qtyInput,
          conversionFactor: preparedTaskQty.conversionFactor,
          serialNos: normalizedPlanSerials.length > 0 ? normalizedPlanSerials : undefined,
          assignedTo: dto.assignedTo?.trim(),
        },
      });
      if (normalizedPlanSerials.length > 0) {
        await tx.outboundSerialReservation.updateMany({
          where: {
            salesOrderItemId: dto.salesOrderItemId,
            productId: item.productId,
            serialNo: { in: normalizedPlanSerials },
            status: OutboundSerialReservationStatus.ACTIVE,
          },
          data: { outboundTaskId: task.id },
        });
      }

      const nextStatus =
        dto.taskType === OutboundTaskType.PICKING
          ? SalesOrderStatus.PICKING
          : dto.taskType === OutboundTaskType.PACKING
            ? SalesOrderStatus.PACKING
            : SalesOrderStatus.LOADING;
      await tx.salesOrder.update({
        where: { id: dto.salesOrderId },
        data: { status: nextStatus },
      });
      await this.recordOutboundEvent(tx, {
        salesOrderId: dto.salesOrderId,
        outboundTaskId: task.id,
        warehouseId: order.warehouseId,
        customerId: order.customerId,
        operatorCompanyId: user?.operatorCompanyId,
        eventCode: 'TASK_CREATED',
        metadata: {
          taskType: dto.taskType,
          qtyTaskInput: dto.qtyTask,
          qtyTaskBase: preparedTaskQty.qtyBase.toString(),
          uomId: preparedTaskQty.uomId,
          conversionFactor: preparedTaskQty.conversionFactor.toString(),
          sourceBinId: dto.sourceBinId ?? null,
          serialNos: normalizedPlanSerials,
        },
      });

      return tx.outboundTask.findUnique({
        where: { id: task.id },
        include: { salesOrder: true, salesOrderItem: true, wave: true, warehouse: true, sourceBin: true },
      });
    });
  }

  async completeTask(id: string, dto: CompleteOutboundTaskDto, user?: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.outboundTask.findUnique({
        where: { id },
        include: { salesOrder: true, salesOrderItem: true },
      });
      if (!task) throw new BadRequestException('Task not found');
      this.assertWarehouseAllowed(user, task.warehouseId);
      if (task.status === OutboundTaskStatus.DONE || task.status === OutboundTaskStatus.CANCELLED) {
        throw new BadRequestException('Task already closed');
      }

      const remaining = new Prisma.Decimal(task.qtyTask).minus(task.qtyDone);
      let toComplete = remaining;
      let qtyDoneInput = remaining;
      let qtyDoneUomId: string | null = null;
      let qtyDoneConversionFactor = new Prisma.Decimal(1);
      if (dto.qtyDone !== undefined) {
        const preparedDoneQty = await this.prepareProductQtyForOutbound(
          tx,
          task.salesOrder.customerId,
          task.productId,
          dto.uomId ?? task.uomId ?? undefined,
          dto.qtyDone,
        );
        toComplete = preparedDoneQty.qtyBase;
        qtyDoneInput = preparedDoneQty.qtyInput;
        qtyDoneUomId = preparedDoneQty.uomId;
        qtyDoneConversionFactor = preparedDoneQty.conversionFactor;
      }
      if (toComplete.lte(0)) throw new BadRequestException('qtyDone must be greater than zero');
      if (toComplete.greaterThan(remaining)) throw new BadRequestException('qtyDone exceeds remaining task quantity');
      const taskSerials = this.jsonToStringArray(task.serialNos);
      const requestedSerials = this.normalizeSerialNos(dto.serialNos);
      const effectiveSerials = requestedSerials.length > 0 ? requestedSerials : taskSerials;
      if (effectiveSerials.length > 0 && new Prisma.Decimal(effectiveSerials.length).greaterThan(toComplete)) {
        throw new BadRequestException('Serial count cannot exceed qtyDone');
      }
      await this.assertReservableProductSerials(
        tx,
        task.salesOrder.customerId,
        task.productId,
        effectiveSerials,
        task.salesOrderId,
        task.salesOrderItemId,
        task.id,
      );

      const nextQtyDone = new Prisma.Decimal(task.qtyDone).plus(toComplete);
      const done = nextQtyDone.equals(task.qtyTask);
      const updatedTask = await tx.outboundTask.update({
        where: { id: task.id },
        data: {
          qtyDone: nextQtyDone,
          serialNos: effectiveSerials.length > 0 ? effectiveSerials : undefined,
          status: done ? OutboundTaskStatus.DONE : OutboundTaskStatus.IN_PROGRESS,
          completedAt: done ? new Date() : null,
        },
      });
      if (effectiveSerials.length > 0) {
        await tx.outboundSerialReservation.updateMany({
          where: {
            salesOrderId: task.salesOrderId,
            salesOrderItemId: task.salesOrderItemId,
            productId: task.productId,
            serialNo: { in: effectiveSerials },
            status: OutboundSerialReservationStatus.ACTIVE,
          },
          data: {
            status: done ? OutboundSerialReservationStatus.CONSUMED : OutboundSerialReservationStatus.ACTIVE,
            outboundTaskId: task.id,
            consumedAt: done ? new Date() : null,
          },
        });
      }

      if (task.taskType === OutboundTaskType.PICKING) {
        await tx.salesOrderItem.update({
          where: { id: task.salesOrderItemId },
          data: { qtyPicked: { increment: toComplete } },
        });
      } else if (task.taskType === OutboundTaskType.PACKING) {
        await tx.salesOrderItem.update({
          where: { id: task.salesOrderItemId },
          data: { qtyPacked: { increment: toComplete } },
        });
      } else if (task.taskType === OutboundTaskType.LOADING) {
        await tx.salesOrderItem.update({
          where: { id: task.salesOrderItemId },
          data: { qtyShipped: { increment: toComplete } },
        });
      }

      const refreshedOrder = await tx.salesOrder.findUnique({
        where: { id: task.salesOrderId },
        include: { items: true },
      });
      if (!refreshedOrder) throw new BadRequestException('Sales order not found after task completion');

      const allShipped = refreshedOrder.items.every((it) =>
        new Prisma.Decimal(it.qtyShipped).greaterThanOrEqualTo(it.qtyOrdered),
      );
      const progressStatus = this.statusFromTaskType(task.taskType);

      await tx.salesOrder.update({
        where: { id: refreshedOrder.id },
        data: {
          status: allShipped ? SalesOrderStatus.SHIPPED : progressStatus,
          shippedAt: allShipped ? new Date() : refreshedOrder.shippedAt,
        },
      });
      if (done) {
        await this.recordOutboundEvent(tx, {
          salesOrderId: task.salesOrderId,
          outboundTaskId: task.id,
          warehouseId: task.warehouseId,
          customerId: task.salesOrder.customerId,
          operatorCompanyId: user?.operatorCompanyId,
          eventCode: 'TASK_COMPLETED',
          metadata: {
            taskType: task.taskType,
            qtyDoneInput: qtyDoneInput.toString(),
            qtyDoneUomId,
            qtyDoneConversionFactor: qtyDoneConversionFactor.toString(),
            qtyDoneBase: toComplete.toString(),
            qtyTask: task.qtyTask.toString(),
            serialNos: effectiveSerials,
          },
        });
        await this.createOutboundBillingTransaction(tx, {
          task: updatedTask,
          order: task.salesOrder,
          operatorCompanyId: user?.operatorCompanyId,
          qty: toComplete,
        });
      }
      if (allShipped) {
        await this.recordOutboundEvent(tx, {
          salesOrderId: task.salesOrderId,
          warehouseId: task.warehouseId,
          customerId: task.salesOrder.customerId,
          operatorCompanyId: user?.operatorCompanyId,
          eventCode: 'ORDER_SHIPPED',
          note: 'Sales order fully shipped',
        });
      }

      return tx.outboundTask.findUnique({
        where: { id: task.id },
        include: {
          salesOrder: { include: { items: true } },
          salesOrderItem: true,
          wave: true,
          warehouse: true,
          sourceBin: true,
        },
      });
    });
  }

  async updateTask(id: string, dto: UpdateOutboundTaskDto, user?: JwtPayload) {
    const task = await this.prisma.outboundTask.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        warehouseId: true,
        qtyTask: true,
        qtyDone: true,
        productId: true,
        serialNos: true,
        salesOrder: { select: { customerId: true } },
      },
    });
    if (!task) throw new BadRequestException('Task not found');
    this.assertWarehouseAllowed(user, task.warehouseId);
    if (task.status === OutboundTaskStatus.DONE && dto.status !== OutboundTaskStatus.DONE) {
      throw new BadRequestException('Done task cannot be reopened');
    }
    const hasSerialField = Object.prototype.hasOwnProperty.call(dto, 'serialNos');
    let nextSerialNos: string[] | undefined;
    if (hasSerialField) {
      const normalized = this.normalizeSerialNos(dto.serialNos);
      const qtyTask = new Prisma.Decimal(task.qtyTask);
      const qtyDone = new Prisma.Decimal(task.qtyDone);
      if (normalized.length > 0 && new Prisma.Decimal(normalized.length).greaterThan(qtyTask)) {
        throw new BadRequestException('Serial count cannot exceed qtyTask');
      }
      if (new Prisma.Decimal(normalized.length).lessThan(qtyDone)) {
        throw new BadRequestException('Serial count cannot be lower than qtyDone');
      }
      await this.assertReservableProductSerials(
        this.prisma,
        task.salesOrder.customerId,
        task.productId,
        normalized,
        undefined,
        undefined,
        task.id,
      );
      nextSerialNos = normalized;
    }

    return this.prisma.outboundTask.update({
      where: { id },
      data: {
        assignedTo: dto.assignedTo?.trim(),
        status: dto.status,
        serialNos: hasSerialField ? (nextSerialNos && nextSerialNos.length > 0 ? nextSerialNos : Prisma.JsonNull) : undefined,
        completedAt:
          dto.status === OutboundTaskStatus.DONE ? new Date() : dto.status === OutboundTaskStatus.CANCELLED ? null : undefined,
      },
      include: {
        salesOrder: true,
        salesOrderItem: {
          include: {
            product: {
              include: {
                baseUom: true,
                uomConversions: { where: { isActive: true }, include: { fromUom: true, toUom: true } },
              },
            },
          },
        },
        wave: true,
        warehouse: true,
        sourceBin: true,
      },
    });
  }

  async softDeleteTask(id: string, user?: JwtPayload) {
    const task = await this.prisma.outboundTask.findUnique({
      where: { id },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!task) throw new BadRequestException('Task not found');
    this.assertWarehouseAllowed(user, task.warehouseId);
    if (task.status === OutboundTaskStatus.DONE) {
      throw new BadRequestException('Done task cannot be cancelled');
    }

    await this.prisma.outboundTask.update({
      where: { id },
      data: {
        status: OutboundTaskStatus.CANCELLED,
        completedAt: null,
      },
    });
    await this.prisma.outboundSerialReservation.updateMany({
      where: { outboundTaskId: id, status: OutboundSerialReservationStatus.ACTIVE },
      data: {
        status: OutboundSerialReservationStatus.RELEASED,
        releasedAt: new Date(),
        releaseReason: 'TASK_CANCELLED',
        outboundTaskId: null,
      },
    });
    return { success: true, mode: 'soft', id };
  }

  private parseTaskStatus(status: string): OutboundTaskStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized in OutboundTaskStatus) {
      return OutboundTaskStatus[normalized as keyof typeof OutboundTaskStatus];
    }
    throw new BadRequestException(`Invalid task status: ${status}`);
  }

  private parseSerialReservationStatus(status: string): OutboundSerialReservationStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized in OutboundSerialReservationStatus) {
      return OutboundSerialReservationStatus[normalized as keyof typeof OutboundSerialReservationStatus];
    }
    throw new BadRequestException(`Invalid serial reservation status: ${status}`);
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

    const uniq = [...new Set(productIds)];
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniq }, customerId, isActive: true },
      select: { id: true },
    });
    if (products.length !== uniq.length) {
      throw new BadRequestException('One or more products are invalid for this customer');
    }
  }

  private async allocateSalesOrderInternal(id: string, reallocate: boolean, user?: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });
      if (!order) throw new BadRequestException('Sales order not found');
      this.assertWarehouseAllowed(user, order.warehouseId);
      if (order.status === SalesOrderStatus.CANCELLED || order.status === SalesOrderStatus.SHIPPED) {
        throw new BadRequestException('Sales order is not eligible for allocation');
      }

      if (reallocate) {
        await tx.outboundAllocation.deleteMany({ where: { salesOrderId: id } });
        await tx.outboundSerialReservation.updateMany({
          where: { salesOrderId: id, status: OutboundSerialReservationStatus.ACTIVE },
          data: {
            status: OutboundSerialReservationStatus.RELEASED,
            releasedAt: new Date(),
            releaseReason: 'REALLOCATE_REFRESH',
            outboundTaskId: null,
          },
        });
      }

      const results: Array<{
        salesOrderItemId: string;
        productId: string;
        qtyRequested: string;
        qtyAllocated: string;
        isFullyAllocated: boolean;
      }> = [];

      const inboundCustomsHoldBinIds = new Set<string>();

      for (const item of order.items) {
        const requestedQty = new Prisma.Decimal(item.qtyOrdered);
        const existingAllocatedRows = await tx.outboundAllocation.findMany({
          where: { salesOrderItemId: item.id },
          select: { qtyAllocated: true },
        });
        const alreadyAllocated = existingAllocatedRows.reduce(
          (sum, row) => sum.plus(row.qtyAllocated),
          new Prisma.Decimal(0),
        );
        let remainingToAllocate = requestedQty.minus(alreadyAllocated);
        if (remainingToAllocate.lte(0)) {
          results.push({
            salesOrderItemId: item.id,
            productId: item.productId,
            qtyRequested: requestedQty.toString(),
            qtyAllocated: requestedQty.toString(),
            isFullyAllocated: true,
          });
          continue;
        }

        const balances = await tx.inventoryBalance.findMany({
          where: {
            customerId: order.customerId,
            warehouseId: order.warehouseId,
            productId: item.productId,
            qtyOnHand: { gt: new Prisma.Decimal(0) },
          },
          orderBy: [{ updatedAt: 'asc' }],
          select: { binId: true, qtyOnHand: true },
        });

        const heldByBin = await mapInboundCustomsHeldQtyByBin(tx, {
          customerId: order.customerId,
          warehouseId: order.warehouseId,
          productId: item.productId,
          binIds: balances.map((b) => b.binId),
        });

        let allocatedThisRound = new Prisma.Decimal(0);
        for (const balance of balances) {
          if (remainingToAllocate.lte(0)) break;
          const onHandQty = new Prisma.Decimal(balance.qtyOnHand);
          const heldQty = heldByBin.get(balance.binId) ?? new Prisma.Decimal(0);
          if (heldQty.gt(0)) {
            inboundCustomsHoldBinIds.add(balance.binId);
          }
          const effectiveOnHand = effectiveQtyOnHandAfterCustomsHold(onHandQty, heldQty);
          const allocQty = remainingToAllocate.lte(effectiveOnHand) ? remainingToAllocate : effectiveOnHand;
          if (allocQty.lte(0)) continue;
          await tx.outboundAllocation.create({
            data: {
              salesOrderId: order.id,
              salesOrderItemId: item.id,
              customerId: order.customerId,
              warehouseId: order.warehouseId,
              productId: item.productId,
              binId: balance.binId,
              qtyAllocated: allocQty,
            },
          });
          allocatedThisRound = allocatedThisRound.plus(allocQty);
          remainingToAllocate = remainingToAllocate.minus(allocQty);
        }

        const finalAllocated = alreadyAllocated.plus(allocatedThisRound);
        results.push({
          salesOrderItemId: item.id,
          productId: item.productId,
          qtyRequested: requestedQty.toString(),
          qtyAllocated: finalAllocated.toString(),
          isFullyAllocated: finalAllocated.greaterThanOrEqualTo(requestedQty),
        });
      }

      const allAllocated = results.every((r) => r.isFullyAllocated);
      const partialAllocated = results.some((r) => new Prisma.Decimal(r.qtyAllocated).greaterThan(0)) && !allAllocated;
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: allAllocated || partialAllocated ? SalesOrderStatus.ALLOCATED : order.status,
        },
      });
      const serialReservation = await this.reserveSerialsForSalesOrder(tx, {
        salesOrderId: order.id,
        operatorCompanyId: user?.operatorCompanyId,
      });

      await this.recordOutboundEvent(tx, {
        salesOrderId: order.id,
        warehouseId: order.warehouseId,
        customerId: order.customerId,
        operatorCompanyId: user?.operatorCompanyId,
        eventCode: reallocate ? 'ORDER_REALLOCATED' : 'ORDER_ALLOCATED',
        note: reallocate ? 'Outbound allocations regenerated' : 'Outbound allocations generated',
        metadata: {
          allAllocated,
          itemCount: results.length,
          allocatedItemCount: results.filter((r) => new Prisma.Decimal(r.qtyAllocated).greaterThan(0)).length,
          serialReservation: {
            reservedCount: serialReservation.reservedCount,
            targetedCount: serialReservation.targetedCount,
            unresolvedCount: serialReservation.unresolvedCount,
          },
          ...(inboundCustomsHoldBinIds.size > 0
            ? {
                inboundCustomsHoldApplied: true,
                inboundCustomsHoldBinIds: [...inboundCustomsHoldBinIds],
              }
            : {}),
        },
      });

      return {
        salesOrderId: order.id,
        status: allAllocated ? 'FULLY_ALLOCATED' : partialAllocated ? 'PARTIALLY_ALLOCATED' : 'NOT_ALLOCATED',
        lines: results,
      };
    });
  }

  private assertAllowedStatusTransition(from: SalesOrderStatus, to: SalesOrderStatus) {
    if (from === to) return;
    const allowed = OutboundService.ALLOWED_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Invalid sales order status transition from ${from} to ${to}`);
    }
  }

  private statusFromTaskType(taskType: OutboundTaskType): SalesOrderStatus {
    if (taskType === OutboundTaskType.PICKING) return SalesOrderStatus.PICKING;
    if (taskType === OutboundTaskType.PACKING) return SalesOrderStatus.PACKING;
    return SalesOrderStatus.LOADING;
  }

  private outboundActivityCode(taskType: OutboundTaskType): string {
    if (taskType === OutboundTaskType.PICKING) return 'OUT_PICK_QTY';
    if (taskType === OutboundTaskType.PACKING) return 'OUT_PACK_QTY';
    return 'OUT_LOAD_QTY';
  }

  private periodKeyFromDate(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private jsonToStringArray(value: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  private normalizeSerialNos(serialNos?: string[]): string[] {
    if (!Array.isArray(serialNos)) return [];
    const normalized = serialNos.map((s) => String(s).trim()).filter(Boolean);
    return [...new Set(normalized)];
  }

  private async prepareProductQtyForOutbound(
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

  private async reserveSerialsForSalesOrder(
    tx: Prisma.TransactionClient | PrismaService,
    params: { salesOrderId: string; waveId?: string; operatorCompanyId?: string | null },
  ): Promise<{ reservedCount: number; targetedCount: number; unresolvedCount: number }> {
    const order = await tx.salesOrder.findUnique({
      where: { id: params.salesOrderId },
      include: { items: true },
    });
    if (!order) throw new BadRequestException('Sales order not found');

    let targetedCount = 0;
    let reservedCount = 0;
    for (const item of order.items) {
      const targetCount = Math.floor(Number(item.qtyOrdered));
      if (!Number.isFinite(targetCount) || targetCount <= 0) continue;
      targetedCount += targetCount;

      const existing = await tx.outboundSerialReservation.findMany({
        where: {
          salesOrderItemId: item.id,
          productId: item.productId,
          status: OutboundSerialReservationStatus.ACTIVE,
        },
        orderBy: [{ reservedAt: 'asc' }],
        select: { id: true, serialNo: true },
      });
      if (existing.length > 0) {
        if (params.waveId) {
          await tx.outboundSerialReservation.updateMany({
            where: { id: { in: existing.map((row) => row.id) } },
            data: { waveId: params.waveId },
          });
        }
        reservedCount += Math.min(existing.length, targetCount);
      }

      const missingCount = Math.max(0, targetCount - existing.length);
      if (missingCount === 0) continue;

      const takenRows = await tx.$queryRaw<Array<{ serialNo: string }>>`
        SELECT DISTINCT serial_no AS "serialNo" FROM (
          SELECT sns.sn AS serial_no
          FROM outbound_tasks ot
          JOIN sales_orders so ON so.id = ot.sales_order_id
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ot.serial_nos, '[]'::jsonb)) AS sns(sn)
          WHERE so.customer_id = ${order.customerId}
            AND ot.product_id = ${item.productId}
            AND ot.status IN ('OPEN', 'IN_PROGRESS', 'DONE')

          UNION

          SELECT osr.serial_no
          FROM outbound_serial_reservations osr
          JOIN sales_orders so2 ON so2.id = osr.sales_order_id
          WHERE so2.customer_id = ${order.customerId}
            AND osr.product_id = ${item.productId}
            AND osr.status = 'ACTIVE'
        ) t
      `;
      const takenSerials = takenRows.map((row) => row.serialNo);
      const traceRows =
        takenSerials.length > 0
          ? await tx.$queryRaw<Array<{ serialNo: string }>>`
              SELECT DISTINCT serial_no AS "serialNo" FROM (
                SELECT sns.sn AS serial_no
                FROM inbound_receipts ir
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ir.serial_nos, '[]'::jsonb)) AS sns(sn)
                WHERE ir.customer_id = ${order.customerId}
                  AND ir.warehouse_id = ${order.warehouseId}
                  AND ir.product_id = ${item.productId}

                UNION

                SELECT sns.sn AS serial_no
                FROM material_transformations mt
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mt.output_serial_nos, '[]'::jsonb)) AS sns(sn)
                WHERE mt.customer_id = ${order.customerId}
                  AND mt.warehouse_id = ${order.warehouseId}
                  AND mt.output_product_id = ${item.productId}
              ) s
              WHERE serial_no NOT IN (${Prisma.join(takenSerials.map((sn) => Prisma.sql`${sn}`))})
              ORDER BY serial_no ASC
              LIMIT ${missingCount}
            `
          : await tx.$queryRaw<Array<{ serialNo: string }>>`
              SELECT DISTINCT serial_no AS "serialNo" FROM (
                SELECT sns.sn AS serial_no
                FROM inbound_receipts ir
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ir.serial_nos, '[]'::jsonb)) AS sns(sn)
                WHERE ir.customer_id = ${order.customerId}
                  AND ir.warehouse_id = ${order.warehouseId}
                  AND ir.product_id = ${item.productId}

                UNION

                SELECT sns.sn AS serial_no
                FROM material_transformations mt
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mt.output_serial_nos, '[]'::jsonb)) AS sns(sn)
                WHERE mt.customer_id = ${order.customerId}
                  AND mt.warehouse_id = ${order.warehouseId}
                  AND mt.output_product_id = ${item.productId}
              ) s
              ORDER BY serial_no ASC
              LIMIT ${missingCount}
            `;
      if (traceRows.length > 0) {
        await tx.outboundSerialReservation.createMany({
          data: traceRows.map((row) => ({
            salesOrderId: order.id,
            salesOrderItemId: item.id,
            waveId: params.waveId,
            customerId: order.customerId,
            warehouseId: order.warehouseId,
            productId: item.productId,
            serialNo: row.serialNo,
            status: OutboundSerialReservationStatus.ACTIVE,
          })),
          skipDuplicates: true,
        });
        reservedCount += traceRows.length;
      }
    }

    const unresolvedCount = Math.max(0, targetedCount - reservedCount);
    if (unresolvedCount > 0) {
      await this.recordOutboundEvent(tx, {
        salesOrderId: order.id,
        warehouseId: order.warehouseId,
        customerId: order.customerId,
        operatorCompanyId: params.operatorCompanyId,
        eventCode: 'SERIAL_RESERVATION_PARTIAL',
        note: 'Unable to reserve all serials during pre-task planning',
        metadata: { targetedCount, reservedCount, unresolvedCount, waveId: params.waveId ?? null },
      });
    }
    return { targetedCount, reservedCount, unresolvedCount };
  }

  private async recordSerialConflictObservation(params: {
    salesOrderId?: string;
    customerId: string;
    productId: string;
    conflictType: string;
    detail: string;
  }) {
    if (!params.salesOrderId) return;
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: params.salesOrderId },
      select: { id: true, warehouseId: true, customerId: true },
    });
    if (!order) return;
    await this.prisma.outboundEventLog.create({
      data: {
        salesOrderId: order.id,
        warehouseId: order.warehouseId,
        customerId: order.customerId,
        eventCode: 'SERIAL_CONFLICT_DETECTED',
        note: params.conflictType,
        metadata: {
          productId: params.productId,
          conflictType: params.conflictType,
          detail: params.detail,
        },
      },
    });
  }

  private async assertReservableProductSerials(
    tx: Prisma.TransactionClient | PrismaService,
    customerId: string,
    productId: string,
    serialNos?: string[],
    salesOrderIdForEvent?: string,
    salesOrderItemIdForEvent?: string,
    excludeTaskId?: string,
  ) {
    const normalized = this.normalizeSerialNos(serialNos);
    if (normalized.length === 0) return;
    const values = Prisma.join(normalized.map((s) => Prisma.sql`${s}`));
    const traceRows = await tx.$queryRaw<Array<{ serialNo: string }>>`
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
      ) d
    `;

    const conflictingTasks = await tx.$queryRaw<
      Array<{ serialNo: string; taskId: string; taskStatus: string; orderNo: string | null }>
    >`
      SELECT DISTINCT
        sns.sn AS "serialNo",
        ot.id AS "taskId",
        ot.status::text AS "taskStatus",
        so.order_no AS "orderNo"
      FROM outbound_tasks ot
      JOIN sales_orders so ON so.id = ot.sales_order_id
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ot.serial_nos, '[]'::jsonb)) AS sns(sn)
      WHERE so.customer_id = ${customerId}
        AND ot.product_id = ${productId}
        AND ot.status IN ('OPEN', 'IN_PROGRESS', 'DONE')
        AND (${excludeTaskId ?? null} IS NULL OR ot.id <> ${excludeTaskId ?? null})
        AND sns.sn IN (${values})
    `;
    const conflictingReservations = await tx.$queryRaw<
      Array<{ serialNo: string; salesOrderId: string; orderNo: string | null; reservationStatus: string }>
    >`
      SELECT DISTINCT
        osr.serial_no AS "serialNo",
        osr.sales_order_id AS "salesOrderId",
        so.order_no AS "orderNo",
        osr.status::text AS "reservationStatus"
      FROM outbound_serial_reservations osr
      JOIN sales_orders so ON so.id = osr.sales_order_id
      WHERE so.customer_id = ${customerId}
        AND osr.product_id = ${productId}
        AND osr.status = 'ACTIVE'
        AND (${salesOrderItemIdForEvent ?? null} IS NULL OR osr.sales_order_item_id <> ${salesOrderItemIdForEvent ?? null})
        AND osr.serial_no IN (${values})
    `;
    if (conflictingTasks.length > 0) {
      const sample = conflictingTasks
        .slice(0, 3)
        .map((d) => `${d.serialNo}=>${d.orderNo ?? '-'}:${d.taskStatus}:${d.taskId.slice(0, 8)}`)
        .join(', ');
      await this.recordSerialConflictObservation({
        salesOrderId: salesOrderIdForEvent,
        customerId,
        productId,
        conflictType: 'SERIAL_USED_IN_TASK',
        detail: sample,
      });
      throw new BadRequestException(`Serial already reserved/used for this customer/product (${sample})`);
    }
    if (conflictingReservations.length > 0) {
      const sample = conflictingReservations
        .slice(0, 3)
        .map((d) => `${d.serialNo}=>${d.orderNo ?? '-'}:${d.reservationStatus}`)
        .join(', ');
      await this.recordSerialConflictObservation({
        salesOrderId: salesOrderIdForEvent,
        customerId,
        productId,
        conflictType: 'SERIAL_RESERVED_BY_OTHER_ORDER',
        detail: sample,
      });
      throw new BadRequestException(`Serial already pre-reserved by another order (${sample})`);
    }

    const matched = new Set(traceRows.map((d) => d.serialNo));
    const missing = normalized.filter((sn) => !matched.has(sn));
    if (missing.length > 0) {
      const sample = missing.slice(0, 5).join(', ');
      throw new BadRequestException(`Serial not found in inbound/transformation trace: ${sample}`);
    }
  }

  private async createOutboundBillingTransaction(
    tx: Prisma.TransactionClient,
    params: {
      task: { id: string; taskType: OutboundTaskType; completedAt: Date | null };
      order: { id: string; customerId: string; warehouseId: string };
      operatorCompanyId?: string | null;
      qty: Prisma.Decimal;
    },
  ) {
    const occurredAt = params.task.completedAt ?? new Date();
    const activityCode = this.outboundActivityCode(params.task.taskType);
    const activeRate = await tx.billingRate.findFirst({
      where: {
        isActive: true,
        activityCode,
        component: BillingComponent.HANDLING,
        contract: { customerId: params.order.customerId, isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      select: { rate: true },
    });
    const rate = activeRate?.rate ?? new Prisma.Decimal(0);
    const amount = new Prisma.Decimal(params.qty).mul(rate);

    await tx.billingTransaction.create({
      data: {
        customerId: params.order.customerId,
        warehouseId: params.order.warehouseId,
        operatorCompanyId: params.operatorCompanyId,
        component: BillingComponent.HANDLING,
        activityCode,
        uom: 'QTY',
        qty: params.qty,
        amount,
        referenceType: 'OUTBOUND_TASK',
        referenceId: params.task.id,
        periodKey: this.periodKeyFromDate(occurredAt),
        status: BillingTransactionStatus.DRAFT,
        occurredAt,
        note: `Auto-generated from ${params.task.taskType} completion`,
      },
    });
  }

  private async recordOutboundEvent(
    tx: Prisma.TransactionClient | PrismaService,
    params: {
      salesOrderId: string;
      outboundTaskId?: string | null;
      warehouseId: string;
      customerId: string;
      operatorCompanyId?: string | null;
      eventCode: string;
      note?: string;
      metadata?: Prisma.JsonObject;
    },
  ) {
    const created = await tx.outboundEventLog.create({
      data: {
        salesOrderId: params.salesOrderId,
        outboundTaskId: params.outboundTaskId ?? null,
        warehouseId: params.warehouseId,
        customerId: params.customerId,
        operatorCompanyId: params.operatorCompanyId,
        eventCode: params.eventCode,
        note: params.note,
        metadata: params.metadata,
      },
    });
    if (params.eventCode === 'SERIAL_CONFLICT_DETECTED' || params.eventCode === 'SERIAL_RESERVATION_PARTIAL') {
      await this.sendSerialGovernanceAlert(params, created.id);
    }
  }

  private async sendSerialGovernanceAlert(
    params: {
      salesOrderId: string;
      outboundTaskId?: string | null;
      warehouseId: string;
      customerId: string;
      operatorCompanyId?: string | null;
      eventCode: string;
      note?: string;
      metadata?: Prisma.JsonObject;
    },
    outboundEventId: string,
  ) {
    const webhookUrl = this.config.get<string>('INTEGRATION_ALERT_WEBHOOK_URL')?.trim();
    if (!webhookUrl) return;
    try {
      const payload = {
        source: 'wms-backend',
        category: 'SERIAL_GOVERNANCE_ALERT',
        outboundEventId,
        eventCode: params.eventCode,
        note: params.note ?? null,
        occurredAt: new Date().toISOString(),
        salesOrderId: params.salesOrderId,
        outboundTaskId: params.outboundTaskId ?? null,
        customerId: params.customerId,
        warehouseId: params.warehouseId,
        operatorCompanyId: params.operatorCompanyId ?? null,
        metadata: params.metadata ?? null,
      };
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        this.logger.warn(
          `Serial governance alert webhook responded ${response.status} for event ${params.eventCode} (${outboundEventId})`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Failed to send serial governance alert webhook: ${message}`);
    }
  }
}
