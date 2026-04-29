import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  BillingComponent,
  BillingTransactionStatus,
  OutboundTaskStatus,
  OutboundTaskType,
  Prisma,
  SalesOrderStatus,
  WarehouseType,
} from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
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
  constructor(private readonly prisma: PrismaService) {}

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
        items: { include: { product: true } },
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
      await this.recordOutboundEvent(this.prisma, {
        salesOrderId: dto.salesOrderId,
        warehouseId: order.warehouseId,
        customerId: created.salesOrder.customerId,
        operatorCompanyId: user?.operatorCompanyId,
        eventCode: 'WAVE_CREATED',
        note: `Wave ${created.waveNo} created`,
        metadata: { waveId: created.id, waveNo: created.waveNo },
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
        sourceBin: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async listEvents(user?: JwtPayload, salesOrderId?: string, outboundTaskId?: string) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.outboundEventLog.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(salesOrderId ? { salesOrderId } : {}),
        ...(outboundTaskId ? { outboundTaskId } : {}),
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
          qtyTask: new Prisma.Decimal(dto.qtyTask),
          assignedTo: dto.assignedTo?.trim(),
        },
      });

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
          qtyTask: dto.qtyTask,
          sourceBinId: dto.sourceBinId ?? null,
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
      const toComplete = dto.qtyDone !== undefined ? new Prisma.Decimal(dto.qtyDone) : remaining;
      if (toComplete.lte(0)) throw new BadRequestException('qtyDone must be greater than zero');
      if (toComplete.greaterThan(remaining)) throw new BadRequestException('qtyDone exceeds remaining task quantity');

      const nextQtyDone = new Prisma.Decimal(task.qtyDone).plus(toComplete);
      const done = nextQtyDone.equals(task.qtyTask);
      const updatedTask = await tx.outboundTask.update({
        where: { id: task.id },
        data: {
          qtyDone: nextQtyDone,
          status: done ? OutboundTaskStatus.DONE : OutboundTaskStatus.IN_PROGRESS,
          completedAt: done ? new Date() : null,
        },
      });

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
            qtyDone: toComplete.toString(),
            qtyTask: task.qtyTask.toString(),
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
      select: { id: true, status: true, warehouseId: true },
    });
    if (!task) throw new BadRequestException('Task not found');
    this.assertWarehouseAllowed(user, task.warehouseId);
    if (task.status === OutboundTaskStatus.DONE && dto.status !== OutboundTaskStatus.DONE) {
      throw new BadRequestException('Done task cannot be reopened');
    }

    return this.prisma.outboundTask.update({
      where: { id },
      data: {
        assignedTo: dto.assignedTo?.trim(),
        status: dto.status,
        completedAt:
          dto.status === OutboundTaskStatus.DONE ? new Date() : dto.status === OutboundTaskStatus.CANCELLED ? null : undefined,
      },
      include: {
        salesOrder: true,
        salesOrderItem: { include: { product: true } },
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
    return { success: true, mode: 'soft', id };
  }

  private parseTaskStatus(status: string): OutboundTaskStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized in OutboundTaskStatus) {
      return OutboundTaskStatus[normalized as keyof typeof OutboundTaskStatus];
    }
    throw new BadRequestException(`Invalid task status: ${status}`);
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
      }

      const results: Array<{
        salesOrderItemId: string;
        productId: string;
        qtyRequested: string;
        qtyAllocated: string;
        isFullyAllocated: boolean;
      }> = [];

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

        let allocatedThisRound = new Prisma.Decimal(0);
        for (const balance of balances) {
          if (remainingToAllocate.lte(0)) break;
          const onHandQty = new Prisma.Decimal(balance.qtyOnHand);
          const allocQty = remainingToAllocate.lte(onHandQty) ? remainingToAllocate : onHandQty;
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
    await tx.outboundEventLog.create({
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
  }
}
