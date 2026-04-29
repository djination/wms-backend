import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InternalTransferStatus, MaterialTransformationStatus, Prisma, WarehouseType } from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternalTransferDto } from './dto/create-internal-transfer.dto';
import { CreateMaterialTransformationDto } from './dto/create-material-transformation.dto';
import { CreateProcessRecipeDto } from './dto/create-process-recipe.dto';
import { CreateTransformationFromRecipeDto } from './dto/create-transformation-from-recipe.dto';
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
        lines: { include: { product: true, sourceBin: true, destinationBin: true } },
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

    try {
      return await this.prisma.internalTransfer.create({
        data: {
          transferNo: dto.transferNo.trim().toUpperCase(),
          customerId: dto.customerId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          note: dto.note?.trim(),
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              sourceBinId: line.sourceBinId,
              destinationBinId: line.destinationBinId,
              qty: new Prisma.Decimal(line.qty),
            })),
          },
        },
        include: {
          customer: true,
          fromWarehouse: true,
          toWarehouse: true,
          lines: { include: { product: true, sourceBin: true, destinationBin: true } },
        },
      });
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
        if (!srcInv || new Prisma.Decimal(srcInv.qtyOnHand).lessThan(line.qty)) {
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
          data: { qtyOnHand: { decrement: line.qty } },
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
            qtyOnHand: line.qty,
          },
          update: {
            qtyOnHand: { increment: line.qty },
          },
        });
      }

      return tx.internalTransfer.update({
        where: { id: transfer.id },
        data: {
          status: InternalTransferStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          customer: true,
          fromWarehouse: true,
          toWarehouse: true,
          lines: { include: { product: true, sourceBin: true, destinationBin: true } },
        },
      });
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
        inputs: { include: { product: true, bin: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createTransformation(dto: CreateMaterialTransformationDto, user?: JwtPayload) {
    if (dto.inputs.length === 0) throw new BadRequestException('Transformation inputs cannot be empty');
    this.assertWarehouseAllowed(user, dto.warehouseId);
    await this.assertCustomerWarehouseAndProducts(
      dto.customerId,
      [dto.warehouseId],
      [dto.outputProductId, ...dto.inputs.map((i) => i.productId)],
    );

    try {
      return await this.prisma.materialTransformation.create({
        data: {
          processNo: dto.processNo.trim().toUpperCase(),
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          outputProductId: dto.outputProductId,
          outputBinId: dto.outputBinId,
          qtyOutput: new Prisma.Decimal(dto.qtyOutput),
          note: dto.note?.trim(),
          inputs: {
            create: dto.inputs.map((i) => ({
              productId: i.productId,
              binId: i.binId,
              qtyConsumed: new Prisma.Decimal(i.qtyConsumed),
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          outputProduct: true,
          outputBin: true,
          inputs: { include: { product: true, bin: true } },
        },
      });
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

      return tx.materialTransformation.update({
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

    const inputBinMap = new Map(dto.inputBins.map((b) => [b.productId, b.binId]));
    const missingBinProduct = recipe.lines.find((line) => !inputBinMap.has(line.productId));
    if (missingBinProduct) {
      throw new BadRequestException('Input bin mapping is required for all recipe materials');
    }

    await this.assertCustomerWarehouseAndProducts(
      recipe.customerId,
      [dto.warehouseId],
      [recipe.outputProductId, ...recipe.lines.map((l) => l.productId)],
    );

    const factor = new Prisma.Decimal(dto.qtyOutput).div(recipe.baseOutputQty);
    const computedInputs = recipe.lines.map((line) => ({
      productId: line.productId,
      binId: inputBinMap.get(line.productId)!,
      qtyConsumed: new Prisma.Decimal(line.qtyPerBase).mul(factor),
    }));

    try {
      return await this.prisma.materialTransformation.create({
        data: {
          processNo: dto.processNo.trim().toUpperCase(),
          customerId: recipe.customerId,
          warehouseId: dto.warehouseId,
          outputProductId: recipe.outputProductId,
          outputBinId: dto.outputBinId,
          recipeId: recipe.id,
          qtyOutput: new Prisma.Decimal(dto.qtyOutput),
          note: dto.note?.trim(),
          inputs: {
            create: computedInputs.map((i) => ({
              productId: i.productId,
              binId: i.binId,
              qtyConsumed: i.qtyConsumed,
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          outputProduct: true,
          outputBin: true,
          recipe: { include: { lines: true } },
          inputs: { include: { product: true, bin: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Process number already exists');
      }
      throw err;
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
}
