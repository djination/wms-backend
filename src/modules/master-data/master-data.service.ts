import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, WarehouseType } from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AssignWarehouseCustomersDto } from './dto/assign-warehouse-customers.dto';
import { CreateAreaDto } from './dto/create-area.dto';
import { CreateBinDto } from './dto/create-bin.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateOperatorCompanyDto } from './dto/create-operator-company.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateUomDto } from './dto/create-uom.dto';
import { CreateProductUomConversionDto } from './dto/create-product-uom-conversion.dto';
import { DeleteMode } from './dto/delete-master-data.dto';
import { ListProductUomConversionsDto } from './dto/list-product-uom-conversions.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { UpdateBinDto } from './dto/update-bin.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateOperatorCompanyDto } from './dto/update-operator-company.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { UpdateProductUomConversionDto } from './dto/update-product-uom-conversion.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(user?: JwtPayload) {
    const customerIds = await this.allowedCustomerIdsForUser(user);
    if (customerIds !== undefined && customerIds.length === 0) return [];
    return this.prisma.customer.findMany({
      where: customerIds ? { id: { in: customerIds } } : undefined,
      include: { pics: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createCustomer(dto: CreateCustomerDto, user?: JwtPayload) {
    this.assertSystemAdministratorOnly(user, 'Only system administrator can create customer');
    try {
      const picRows =
        dto.pics?.filter((p) => p.name?.trim())?.map((p, i) => ({
          name: p.name.trim(),
          phone: p.phone?.trim() ? p.phone.trim() : null,
          email: p.email?.trim() ? p.email.trim() : null,
          sortOrder: i,
        })) ?? [];
      return await this.prisma.customer.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          type: dto.type,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          province: dto.province?.trim() || null,
          city: dto.city?.trim() || null,
          district: dto.district?.trim() || null,
          subdistrict: dto.subdistrict?.trim() || null,
          postalCode: dto.postalCode?.trim() || null,
          ...(picRows.length > 0 ? { pics: { create: picRows } } : {}),
        },
        include: { pics: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Customer code already exists');
    }
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, user?: JwtPayload) {
    await this.assertUserAllowedCustomerByCustomerId(user, id);
    await this.assertCustomerExists(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id },
          data: {
            code: dto.code?.trim().toUpperCase(),
            name: dto.name?.trim(),
            type: dto.type,
            phone: dto.phone !== undefined ? (dto.phone?.trim() || null) : undefined,
            address: dto.address !== undefined ? (dto.address?.trim() || null) : undefined,
            province: dto.province !== undefined ? (dto.province?.trim() || null) : undefined,
            city: dto.city !== undefined ? (dto.city?.trim() || null) : undefined,
            district: dto.district !== undefined ? (dto.district?.trim() || null) : undefined,
            subdistrict: dto.subdistrict !== undefined ? (dto.subdistrict?.trim() || null) : undefined,
            postalCode: dto.postalCode !== undefined ? (dto.postalCode?.trim() || null) : undefined,
            isActive: dto.isActive,
          },
        });
        if (dto.pics !== undefined) {
          await tx.customerPic.deleteMany({ where: { customerId: id } });
          const picRows =
            dto.pics
              .filter((p) => p.name?.trim())
              .map((p, i) => ({
                customerId: id,
                name: p.name.trim(),
                phone: p.phone?.trim() ? p.phone.trim() : null,
                email: p.email?.trim() ? p.email.trim() : null,
                sortOrder: i,
              })) ?? [];
          if (picRows.length > 0) {
            await tx.customerPic.createMany({ data: picRows });
          }
        }
        return tx.customer.findUniqueOrThrow({
          where: { id: updated.id },
          include: { pics: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Customer code already exists');
    }
  }

  async deleteCustomer(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedCustomerByCustomerId(user, id);
    await this.assertCustomerExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.customer.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.customer.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listOperatorCompanies(user?: JwtPayload) {
    const filter = this.operatorScopeFilter(user);
    if (filter === null) return [];
    return this.prisma.operatorCompany.findMany({
      where: filter ? { id: filter } : undefined,
      include: { pics: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createOperatorCompany(dto: CreateOperatorCompanyDto, user?: JwtPayload) {
    this.assertSystemAdministratorOnly(user, 'Only system administrator can create operator company');
    try {
      const picRows =
        dto.pics?.filter((p) => p.name?.trim())?.map((p, i) => ({
          name: p.name.trim(),
          phone: p.phone?.trim() ? p.phone.trim() : null,
          email: p.email?.trim() ? p.email.trim() : null,
          sortOrder: i,
        })) ?? [];
      return await this.prisma.operatorCompany.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          province: dto.province?.trim() || null,
          city: dto.city?.trim() || null,
          district: dto.district?.trim() || null,
          subdistrict: dto.subdistrict?.trim() || null,
          postalCode: dto.postalCode?.trim() || null,
          ...(picRows.length > 0 ? { pics: { create: picRows } } : {}),
        },
        include: { pics: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Operator code already exists');
    }
  }

  async updateOperatorCompany(id: string, dto: UpdateOperatorCompanyDto, user?: JwtPayload) {
    this.assertUserAllowedOperator(user, id);
    await this.assertOperatorCompanyExists(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.operatorCompany.update({
          where: { id },
          data: {
            code: dto.code?.trim().toUpperCase(),
            name: dto.name?.trim(),
            phone: dto.phone !== undefined ? (dto.phone?.trim() || null) : undefined,
            address: dto.address !== undefined ? (dto.address?.trim() || null) : undefined,
            province: dto.province !== undefined ? (dto.province?.trim() || null) : undefined,
            city: dto.city !== undefined ? (dto.city?.trim() || null) : undefined,
            district: dto.district !== undefined ? (dto.district?.trim() || null) : undefined,
            subdistrict: dto.subdistrict !== undefined ? (dto.subdistrict?.trim() || null) : undefined,
            postalCode: dto.postalCode !== undefined ? (dto.postalCode?.trim() || null) : undefined,
            isActive: dto.isActive,
          },
        });
        if (dto.pics !== undefined) {
          await tx.operatorCompanyPic.deleteMany({ where: { operatorCompanyId: id } });
          const picRows =
            dto.pics
              .filter((p) => p.name?.trim())
              .map((p, i) => ({
                operatorCompanyId: id,
                name: p.name.trim(),
                phone: p.phone?.trim() ? p.phone.trim() : null,
                email: p.email?.trim() ? p.email.trim() : null,
                sortOrder: i,
              })) ?? [];
          if (picRows.length > 0) {
            await tx.operatorCompanyPic.createMany({ data: picRows });
          }
        }
        return tx.operatorCompany.findUniqueOrThrow({
          where: { id: updated.id },
          include: { pics: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Operator code already exists');
    }
  }

  async deleteOperatorCompany(id: string, mode: DeleteMode, user?: JwtPayload) {
    this.assertUserAllowedOperator(user, id);
    await this.assertOperatorCompanyExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.operatorCompany.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.operatorCompany.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listWarehouses(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    const warehouses = await this.prisma.warehouse.findMany({
      where: warehouseIds ? { id: { in: warehouseIds } } : undefined,
      include: {
        customer: true,
        ownerCompany: true,
        operatorCompany: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return this.mergeWarehouseCustomerMappings(warehouses);
  }

  async createWarehouse(dto: CreateWarehouseDto, user?: JwtPayload) {
    this.assertUserAllowedWarehouseOwnerOperator(user, {
      ownerCompanyId: dto.ownerCompanyId,
      operatorCompanyId: dto.operatorCompanyId,
    });
    const warehouseType = dto.type ?? WarehouseType.SHARED;
    const requestedCustomerIds = [...new Set([...(dto.customerIds ?? []), ...(dto.customerId ? [dto.customerId] : [])])];
    for (const customerId of requestedCustomerIds) {
      await this.assertUserAllowedCustomer(user, customerId);
    }

    const owner = await this.prisma.operatorCompany.findUnique({
      where: { id: dto.ownerCompanyId },
      select: { id: true, isActive: true },
    });
    if (!owner || !owner.isActive) {
      throw new BadRequestException('Owner operator company not found or inactive');
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

    if (warehouseType === WarehouseType.DEDICATED && dto.customerIds && dto.customerIds.length > 0) {
      throw new BadRequestException('Dedicated warehouse supports only single customer');
    }

    if (requestedCustomerIds.length > 0) {
      const count = await this.prisma.customer.count({
        where: { id: { in: requestedCustomerIds }, isActive: true },
      });
      if (count !== requestedCustomerIds.length) {
        throw new BadRequestException('One or more customers not found or inactive');
      }
    }

    try {
      const created = await this.prisma.warehouse.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          type: warehouseType,
          isTransitImportHub: dto.isTransitImportHub ?? false,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          province: dto.province?.trim() || null,
          city: dto.city?.trim() || null,
          district: dto.district?.trim() || null,
          subdistrict: dto.subdistrict?.trim() || null,
          postalCode: dto.postalCode?.trim() || null,
          ownerCompanyId: dto.ownerCompanyId,
          operatorCompanyId: dto.operatorCompanyId,
          customerId: requestedCustomerIds[0] ?? null,
        },
        include: { customer: true, ownerCompany: true, operatorCompany: true },
      });
      if (warehouseType === WarehouseType.SHARED && requestedCustomerIds.length > 0) {
        await this.assignWarehouseCustomers({ warehouseId: created.id, customerIds: requestedCustomerIds });
      }
      return this.getWarehouseWithMappings(created.id);
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Warehouse code already exists');
    }
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseById(user, id);
    const existing = await this.prisma.warehouse.findUnique({
      where: { id },
      select: { ownerCompanyId: true, operatorCompanyId: true, id: true },
    });
    if (!existing) {
      throw new NotFoundException('Warehouse not found');
    }
    this.assertUserAllowedWarehouseOwnerOperator(user, {
      ownerCompanyId: dto.ownerCompanyId ?? existing.ownerCompanyId,
      operatorCompanyId: dto.operatorCompanyId !== undefined ? dto.operatorCompanyId : existing.operatorCompanyId,
    });

    if (dto.ownerCompanyId) {
      const owner = await this.prisma.operatorCompany.findUnique({
        where: { id: dto.ownerCompanyId },
        select: { id: true, isActive: true },
      });
      if (!owner || !owner.isActive) {
        throw new BadRequestException('Owner operator company not found or inactive');
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

    if (dto.customerId) {
      await this.assertUserAllowedCustomer(user, dto.customerId);
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true, isActive: true },
      });
      if (!customer || !customer.isActive) {
        throw new BadRequestException('Customer not found or inactive');
      }
    }

    try {
      const updated = await this.prisma.warehouse.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          type: dto.type,
          isTransitImportHub: dto.isTransitImportHub,
          phone: dto.phone !== undefined ? (dto.phone?.trim() || null) : undefined,
          address: dto.address !== undefined ? (dto.address?.trim() || null) : undefined,
          province: dto.province !== undefined ? (dto.province?.trim() || null) : undefined,
          city: dto.city !== undefined ? (dto.city?.trim() || null) : undefined,
          district: dto.district !== undefined ? (dto.district?.trim() || null) : undefined,
          subdistrict: dto.subdistrict !== undefined ? (dto.subdistrict?.trim() || null) : undefined,
          postalCode: dto.postalCode !== undefined ? (dto.postalCode?.trim() || null) : undefined,
          ownerCompanyId: dto.ownerCompanyId,
          operatorCompanyId: dto.operatorCompanyId,
          customerId: dto.customerId,
          isActive: dto.isActive,
        },
        include: { customer: true, ownerCompany: true, operatorCompany: true },
      });
      return this.getWarehouseWithMappings(updated.id);
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Warehouse code already exists');
    }
  }

  async assignWarehouseCustomers(dto: AssignWarehouseCustomersDto, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseById(user, dto.warehouseId);
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
      select: { id: true, isActive: true, type: true, customerId: true },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }
    if (warehouse.type !== WarehouseType.SHARED) {
      throw new BadRequestException('Only shared warehouse can have multiple customer mappings');
    }

    const customerIds = [...new Set(dto.customerIds)];
    for (const customerId of customerIds) {
      await this.assertUserAllowedCustomer(user, customerId);
    }
    if (customerIds.length > 0) {
      const count = await this.prisma.customer.count({
        where: { id: { in: customerIds }, isActive: true },
      });
      if (count !== customerIds.length) {
        throw new BadRequestException('One or more customers not found or inactive');
      }
    }

    await this.prisma.$executeRaw`
      UPDATE warehouse_customers
      SET is_active = false, updated_at = NOW()
      WHERE warehouse_id = ${dto.warehouseId}
    `;
    if (customerIds.length > 0) {
      for (const customerId of customerIds) {
        const mappingId = randomUUID();
        await this.prisma.$executeRaw`
          INSERT INTO warehouse_customers (id, warehouse_id, customer_id, is_active, created_at, updated_at)
          VALUES (${mappingId}, ${dto.warehouseId}, ${customerId}, true, NOW(), NOW())
          ON CONFLICT (warehouse_id, customer_id)
          DO UPDATE SET is_active = true, updated_at = NOW()
        `;
      }
    }
    await this.prisma.warehouse.update({
      where: { id: dto.warehouseId },
      data: { customerId: customerIds[0] ?? null },
    });

    return this.getWarehouseWithMappings(dto.warehouseId);
  }

  async deleteWarehouse(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseById(user, id);
    await this.assertWarehouseExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.warehouse.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.warehouse.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listAreas(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.warehouseArea.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      include: { warehouse: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createArea(dto: CreateAreaDto, user?: JwtPayload) {
    this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertActiveWarehouse(dto.warehouseId);
    try {
      return await this.prisma.warehouseArea.create({
        data: {
          warehouseId: dto.warehouseId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
        },
        include: { warehouse: true },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Area code already exists in this warehouse');
    }
  }

  async updateArea(id: string, dto: UpdateAreaDto, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseByAreaId(user, id);
    if (dto.warehouseId) this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertAreaExists(id);
    if (dto.warehouseId) {
      await this.assertActiveWarehouse(dto.warehouseId);
    }
    try {
      return await this.prisma.warehouseArea.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          isActive: dto.isActive,
        },
        include: { warehouse: true },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Area code already exists in this warehouse');
    }
  }

  async deleteArea(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseByAreaId(user, id);
    await this.assertAreaExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.warehouseArea.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.warehouseArea.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listZones(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.warehouseZone.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      include: { warehouse: true, area: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createZone(dto: CreateZoneDto, user?: JwtPayload) {
    this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertActiveWarehouse(dto.warehouseId);
    if (dto.areaId) {
      const area = await this.prisma.warehouseArea.findUnique({
        where: { id: dto.areaId },
        select: { id: true, warehouseId: true, isActive: true },
      });
      if (!area || !area.isActive || area.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('Area not found/inactive or does not belong to warehouse');
      }
    }
    try {
      return await this.prisma.warehouseZone.create({
        data: {
          warehouseId: dto.warehouseId,
          areaId: dto.areaId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
        },
        include: { warehouse: true, area: true },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Zone code already exists in this warehouse');
    }
  }

  async updateZone(id: string, dto: UpdateZoneDto, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseByZoneId(user, id);
    if (dto.warehouseId) this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertZoneExists(id);
    if (dto.warehouseId) {
      await this.assertActiveWarehouse(dto.warehouseId);
    }
    if (dto.areaId) {
      const area = await this.prisma.warehouseArea.findUnique({
        where: { id: dto.areaId },
        select: { id: true, warehouseId: true, isActive: true },
      });
      if (!area || !area.isActive) {
        throw new BadRequestException('Area not found or inactive');
      }
      if (dto.warehouseId && area.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('Area does not belong to warehouse');
      }
    }
    try {
      return await this.prisma.warehouseZone.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          areaId: dto.areaId,
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          isActive: dto.isActive,
        },
        include: { warehouse: true, area: true },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Zone code already exists in this warehouse');
    }
  }

  async deleteZone(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseByZoneId(user, id);
    await this.assertZoneExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.warehouseZone.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.warehouseZone.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listBins(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.warehouseBin.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      include: { warehouse: true, zone: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createBin(dto: CreateBinDto, user?: JwtPayload) {
    this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertActiveWarehouse(dto.warehouseId);
    const zone = await this.prisma.warehouseZone.findUnique({
      where: { id: dto.zoneId },
      select: { id: true, warehouseId: true, isActive: true },
    });
    if (!zone || !zone.isActive || zone.warehouseId !== dto.warehouseId) {
      throw new BadRequestException('Zone not found/inactive or does not belong to warehouse');
    }
    try {
      return await this.prisma.warehouseBin.create({
        data: {
          warehouseId: dto.warehouseId,
          zoneId: dto.zoneId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
        },
        include: { warehouse: true, zone: true },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Bin code already exists in this warehouse');
    }
  }

  async updateBin(id: string, dto: UpdateBinDto, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseByBinId(user, id);
    if (dto.warehouseId) this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertBinExists(id);
    if (dto.warehouseId) {
      await this.assertActiveWarehouse(dto.warehouseId);
    }
    if (dto.zoneId) {
      const zone = await this.prisma.warehouseZone.findUnique({
        where: { id: dto.zoneId },
        select: { id: true, warehouseId: true, isActive: true },
      });
      if (!zone || !zone.isActive) {
        throw new BadRequestException('Zone not found or inactive');
      }
      if (dto.warehouseId && zone.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('Zone does not belong to warehouse');
      }
    }
    try {
      return await this.prisma.warehouseBin.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          zoneId: dto.zoneId,
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          isActive: dto.isActive,
        },
        include: { warehouse: true, zone: true },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Bin code already exists in this warehouse');
    }
  }

  async deleteBin(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedWarehouseByBinId(user, id);
    await this.assertBinExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.warehouseBin.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.warehouseBin.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listProducts(user?: JwtPayload) {
    const customerIds = await this.allowedCustomerIdsForUser(user);
    if (customerIds !== undefined && customerIds.length === 0) return [];
    return this.prisma.product.findMany({
      where: customerIds ? { customerId: { in: customerIds } } : undefined,
      include: {
        customer: true,
        baseUom: true,
        supplierMappings: {
          where: { isActive: true },
          include: { supplier: true },
        },
        uomConversions: {
          where: { isActive: true },
          include: { fromUom: true, toUom: true },
          orderBy: [{ createdAt: 'desc' }],
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async listUoms(_user?: JwtPayload) {
    return this.prisma.unitOfMeasure.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
  }

  async listSuppliers(user?: JwtPayload) {
    const customerIds = await this.allowedCustomerIdsForUser(user);
    if (customerIds !== undefined && customerIds.length === 0) return [];
    return this.prisma.supplier.findMany({
      where: customerIds ? { customerId: { in: customerIds } } : undefined,
      include: {
        customer: true,
        pics: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createProduct(dto: CreateProductDto, user?: JwtPayload) {
    await this.assertUserAllowedCustomer(user, dto.customerId);
    await this.assertActiveCustomer(dto.customerId);
    if (dto.supplierIds && dto.supplierIds.length > 0) {
      await this.assertSuppliersBelongToCustomer(dto.customerId, dto.supplierIds);
    }
    if (dto.baseUomId) {
      await this.assertActiveUom(dto.baseUomId);
    }
    try {
      return await this.prisma.product.create({
        data: {
          customerId: dto.customerId,
          sku: dto.sku.trim().toUpperCase(),
          name: dto.name.trim(),
          baseUomId: dto.baseUomId,
          supplierMappings:
            dto.supplierIds && dto.supplierIds.length > 0
              ? {
                  create: [...new Set(dto.supplierIds)].map((supplierId) => ({
                    supplierId,
                    isActive: true,
                  })),
                }
              : undefined,
        },
        include: {
          customer: true,
          baseUom: true,
          supplierMappings: {
            where: { isActive: true },
            include: { supplier: true },
          },
          uomConversions: {
            where: { isActive: true },
            include: { fromUom: true, toUom: true },
            orderBy: [{ createdAt: 'desc' }],
          },
        },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'SKU already exists for this customer');
    }
  }

  async createSupplier(dto: CreateSupplierDto, user?: JwtPayload) {
    await this.assertUserAllowedCustomer(user, dto.customerId);
    await this.assertActiveCustomer(dto.customerId);
    const phone = dto.phone?.trim() ? dto.phone.trim() : null;
    const address = dto.address?.trim() ? dto.address.trim() : null;
    const province = dto.province?.trim() ? dto.province.trim() : null;
    const city = dto.city?.trim() ? dto.city.trim() : null;
    const district = dto.district?.trim() ? dto.district.trim() : null;
    const subdistrict = dto.subdistrict?.trim() ? dto.subdistrict.trim() : null;
    const postalCode = dto.postalCode?.trim() ? dto.postalCode.trim() : null;
    const picRows =
      dto.pics?.filter((p) => p.name?.trim())?.map((p, i) => ({
        name: p.name.trim(),
        phone: p.phone?.trim() ? p.phone.trim() : null,
        email: p.email?.trim() ? p.email.trim() : null,
        sortOrder: i,
      })) ?? [];
    try {
      return await this.prisma.supplier.create({
        data: {
          customerId: dto.customerId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          phone,
          address,
          province,
          city,
          district,
          subdistrict,
          postalCode,
          ...(picRows.length > 0 ? { pics: { create: picRows } } : {}),
        },
        include: {
          customer: true,
          pics: { orderBy: { sortOrder: 'asc' } },
        },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Supplier code already exists for this customer');
    }
  }

  async createUom(dto: CreateUomDto, user?: JwtPayload) {
    this.assertSystemAdministratorOnly(user, 'Only system administrator can create unit of measure');
    try {
      return await this.prisma.unitOfMeasure.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() ? dto.description.trim() : null,
        },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'UOM code already exists');
    }
  }

  async updateProduct(id: string, dto: UpdateProductDto, user?: JwtPayload) {
    await this.assertUserAllowedCustomerByProductId(user, id);
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, customerId: true },
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }
    if (dto.supplierIds) {
      await this.assertSuppliersBelongToCustomer(product.customerId, dto.supplierIds);
    }
    if (dto.baseUomId) {
      await this.assertActiveUom(dto.baseUomId);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined ? { sku: dto.sku.trim().toUpperCase() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.baseUomId !== undefined ? { baseUomId: dto.baseUomId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      if (dto.supplierIds) {
        await tx.productSupplier.updateMany({
          where: { productId: id },
          data: { isActive: false },
        });
        const uniqueSupplierIds = [...new Set(dto.supplierIds)];
        for (const supplierId of uniqueSupplierIds) {
          await tx.productSupplier.upsert({
            where: {
              productId_supplierId: {
                productId: id,
                supplierId,
              },
            },
            create: {
              productId: id,
              supplierId,
              isActive: true,
            },
            update: {
              isActive: true,
            },
          });
        }
      }
      return tx.product.findUnique({
        where: { id: updated.id },
        include: {
          customer: true,
          baseUom: true,
          supplierMappings: {
            where: { isActive: true },
            include: { supplier: true },
          },
          uomConversions: {
            where: { isActive: true },
            include: { fromUom: true, toUom: true },
            orderBy: [{ createdAt: 'desc' }],
          },
        },
      });
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, user?: JwtPayload) {
    await this.assertUserAllowedCustomerBySupplierId(user, id);
    await this.assertSupplierExists(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() ? dto.phone.trim() : null } : {}),
          ...(dto.address !== undefined ? { address: dto.address?.trim() ? dto.address.trim() : null } : {}),
          ...(dto.province !== undefined ? { province: dto.province?.trim() ? dto.province.trim() : null } : {}),
          ...(dto.city !== undefined ? { city: dto.city?.trim() ? dto.city.trim() : null } : {}),
          ...(dto.district !== undefined ? { district: dto.district?.trim() ? dto.district.trim() : null } : {}),
          ...(dto.subdistrict !== undefined
            ? { subdistrict: dto.subdistrict?.trim() ? dto.subdistrict.trim() : null }
            : {}),
          ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode?.trim() ? dto.postalCode.trim() : null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      if (dto.pics !== undefined) {
        await tx.supplierPic.deleteMany({ where: { supplierId: id } });
        const picRows =
          dto.pics
            .filter((p) => p.name?.trim())
            .map((p, i) => ({
              id: randomUUID(),
              supplierId: id,
              name: p.name.trim(),
              phone: p.phone?.trim() ? p.phone.trim() : null,
              email: p.email?.trim() ? p.email.trim() : null,
              sortOrder: i,
            })) ?? [];
        if (picRows.length > 0) {
          await tx.supplierPic.createMany({ data: picRows });
        }
      }
      return tx.supplier.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          customer: true,
          pics: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });
  }

  async updateUom(id: string, dto: UpdateUomDto, user?: JwtPayload) {
    this.assertSystemAdministratorOnly(user, 'Only system administrator can update unit of measure');
    await this.assertUomExists(id);
    try {
      return await this.prisma.unitOfMeasure.update({
        where: { id },
        data: {
          code: dto.code !== undefined ? dto.code.trim().toUpperCase() : undefined,
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          description:
            dto.description !== undefined ? (dto.description?.trim() ? dto.description.trim() : null) : undefined,
          isActive: dto.isActive,
        },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'UOM code already exists');
    }
  }

  async deleteProduct(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedCustomerByProductId(user, id);
    await this.assertProductExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.product.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async deleteSupplier(id: string, mode: DeleteMode, user?: JwtPayload) {
    await this.assertUserAllowedCustomerBySupplierId(user, id);
    await this.assertSupplierExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.supplier.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
    await this.prisma.productSupplier.updateMany({
      where: { supplierId: id },
      data: { isActive: false },
    });
    return { success: true, mode, id };
  }

  async deleteUom(id: string, mode: DeleteMode, user?: JwtPayload) {
    this.assertSystemAdministratorOnly(user, 'Only system administrator can delete unit of measure');
    await this.assertUomExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.unitOfMeasure.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.unitOfMeasure.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  async listInventoryBalances(user?: JwtPayload) {
    const warehouseIds = this.allowedWarehouseIds(user);
    if (warehouseIds !== undefined && warehouseIds.length === 0) return [];
    return this.prisma.inventoryBalance.findMany({
      where: warehouseIds ? { warehouseId: { in: warehouseIds } } : undefined,
      include: {
        customer: true,
        warehouse: true,
        bin: { include: { zone: true } },
        product: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async upsertInventoryBalance(dto: UpsertInventoryDto, user?: JwtPayload) {
    this.assertUserAllowedWarehouse(user, dto.warehouseId);
    await this.assertActiveCustomer(dto.customerId);
    await this.assertCustomerAllowedInWarehouse(dto.customerId, dto.warehouseId);

    const bin = await this.prisma.warehouseBin.findUnique({
      where: { id: dto.binId },
      select: { id: true, warehouseId: true, isActive: true },
    });
    if (!bin || !bin.isActive || bin.warehouseId !== dto.warehouseId) {
      throw new BadRequestException('Bin not found/inactive or does not belong to warehouse');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, customerId: true, isActive: true },
    });
    if (!product || !product.isActive || product.customerId !== dto.customerId) {
      throw new BadRequestException('Product not found/inactive or does not belong to customer');
    }

    return this.prisma.inventoryBalance.upsert({
      where: {
        customerId_warehouseId_binId_productId: {
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          binId: dto.binId,
          productId: dto.productId,
        },
      },
      create: {
        customerId: dto.customerId,
        warehouseId: dto.warehouseId,
        binId: dto.binId,
        productId: dto.productId,
        qtyOnHand: new Prisma.Decimal(dto.qtyOnHand),
      },
      update: {
        qtyOnHand: new Prisma.Decimal(dto.qtyOnHand),
      },
      include: {
        customer: true,
        warehouse: true,
        bin: { include: { zone: true } },
        product: true,
      },
    });
  }

  async listProductUomConversions(query: ListProductUomConversionsDto, user?: JwtPayload) {
    if (query.productId) {
      await this.assertUserAllowedCustomerByProductId(user, query.productId);
    }
    const customerIds = await this.allowedCustomerIdsForUser(user);
    if (!query.productId && customerIds !== undefined && customerIds.length === 0) return [];
    return this.prisma.productUomConversion.findMany({
      where: {
        ...(query.productId ? { productId: query.productId } : {}),
        ...(customerIds ? { product: { customerId: { in: customerIds } } } : {}),
      },
      include: {
        product: { include: { customer: true, baseUom: true } },
        fromUom: true,
        toUom: true,
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createProductUomConversion(dto: CreateProductUomConversionDto, user?: JwtPayload) {
    await this.assertUserAllowedCustomerByProductId(user, dto.productId);
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, isActive: true },
    });
    if (!product || !product.isActive) {
      throw new BadRequestException('Product not found or inactive');
    }
    await this.assertActiveUom(dto.fromUomId);
    await this.assertActiveUom(dto.toUomId);
    if (dto.fromUomId === dto.toUomId) {
      throw new BadRequestException('fromUomId and toUomId cannot be the same');
    }
    try {
      return await this.prisma.productUomConversion.create({
        data: {
          productId: dto.productId,
          fromUomId: dto.fromUomId,
          toUomId: dto.toUomId,
          factor: new Prisma.Decimal(dto.factor),
          note: dto.note?.trim() || null,
          isActive: dto.isActive ?? true,
        },
        include: {
          product: { include: { customer: true, baseUom: true } },
          fromUom: true,
          toUom: true,
        },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Product UOM conversion already exists');
    }
  }

  async updateProductUomConversion(id: string, dto: UpdateProductUomConversionDto, user?: JwtPayload) {
    const existing = await this.prisma.productUomConversion.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });
    if (!existing) throw new NotFoundException('Product UOM conversion not found');
    await this.assertUserAllowedCustomerByProductId(user, existing.productId);
    if (dto.fromUomId) await this.assertActiveUom(dto.fromUomId);
    if (dto.toUomId) await this.assertActiveUom(dto.toUomId);
    const fromUomId = dto.fromUomId ?? undefined;
    const toUomId = dto.toUomId ?? undefined;
    if (fromUomId && toUomId && fromUomId === toUomId) {
      throw new BadRequestException('fromUomId and toUomId cannot be the same');
    }
    try {
      return await this.prisma.productUomConversion.update({
        where: { id },
        data: {
          ...(dto.fromUomId !== undefined ? { fromUomId: dto.fromUomId } : {}),
          ...(dto.toUomId !== undefined ? { toUomId: dto.toUomId } : {}),
          ...(dto.factor !== undefined ? { factor: new Prisma.Decimal(dto.factor) } : {}),
          ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          product: { include: { customer: true, baseUom: true } },
          fromUom: true,
          toUom: true,
        },
      });
    } catch (err) {
      this.rethrowKnownConstraint(err, 'Product UOM conversion already exists');
    }
  }

  async deleteProductUomConversion(id: string, mode: DeleteMode, user?: JwtPayload) {
    const existing = await this.prisma.productUomConversion.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });
    if (!existing) throw new NotFoundException('Product UOM conversion not found');
    await this.assertUserAllowedCustomerByProductId(user, existing.productId);
    if (mode === DeleteMode.HARD) {
      await this.prisma.productUomConversion.delete({ where: { id } });
      return { success: true, mode, id };
    }
    await this.prisma.productUomConversion.update({ where: { id }, data: { isActive: false } });
    return { success: true, mode, id };
  }

  private async assertActiveWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }
  }

  private async assertCustomerAllowedInWarehouse(customerId: string, warehouseId: string) {
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
      return;
    }
    const mappingCustomerIds = await this.getWarehouseMappedCustomerIds(warehouseId);
    if (mappingCustomerIds.length > 0) {
      const allowed = mappingCustomerIds.includes(customerId);
      if (!allowed) {
        throw new BadRequestException('Customer is not mapped to this shared warehouse');
      }
    }
  }

  private async getWarehouseWithMappings(warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: { customer: true, ownerCompany: true, operatorCompany: true },
    });
    if (!warehouse) return null;
    const [enriched] = await this.mergeWarehouseCustomerMappings([warehouse]);
    return enriched;
  }

  private async getWarehouseMappedCustomerIds(warehouseId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ customerId: string }>>`
      SELECT wc.customer_id AS "customerId"
      FROM warehouse_customers wc
      WHERE wc.warehouse_id = ${warehouseId}
        AND wc.is_active = true
    `;
    return rows.map((row) => row.customerId);
  }

  private async mergeWarehouseCustomerMappings<T extends { id: string }>(warehouses: T[]) {
    if (warehouses.length === 0) return warehouses;
    const warehouseIds = warehouses.map((w) => w.id);
    const rows = await this.prisma.$queryRaw<
      Array<{
        warehouseId: string;
        customerId: string;
        customerCode: string;
        customerName: string;
      }>
    >`
      SELECT
        wc.warehouse_id AS "warehouseId",
        c.id AS "customerId",
        c.code AS "customerCode",
        c.name AS "customerName"
      FROM warehouse_customers wc
      JOIN customers c ON c.id = wc.customer_id
      WHERE wc.warehouse_id IN (${Prisma.join(warehouseIds)})
        AND wc.is_active = true
        AND c.is_active = true
    `;
    const byWarehouse = new Map<string, unknown[]>();
    for (const row of rows) {
      const arr = byWarehouse.get(row.warehouseId) ?? [];
      arr.push({
        customerId: row.customerId,
        customer: { id: row.customerId, code: row.customerCode, name: row.customerName },
      });
      byWarehouse.set(row.warehouseId, arr);
    }
    return warehouses.map((warehouse) => ({
      ...warehouse,
      customerMappings: byWarehouse.get(warehouse.id) ?? [],
    }));
  }

  private async assertActiveCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }
  }

  private async assertCustomerExists(id: string) {
    const data = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Customer not found');
  }

  private async assertOperatorCompanyExists(id: string) {
    const data = await this.prisma.operatorCompany.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Operator company not found');
  }

  private async assertWarehouseExists(id: string) {
    const data = await this.prisma.warehouse.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Warehouse not found');
  }

  private async assertAreaExists(id: string) {
    const data = await this.prisma.warehouseArea.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Area not found');
  }

  private async assertZoneExists(id: string) {
    const data = await this.prisma.warehouseZone.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Zone not found');
  }

  private async assertBinExists(id: string) {
    const data = await this.prisma.warehouseBin.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Bin not found');
  }

  private async assertProductExists(id: string) {
    const data = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Product not found');
  }

  private async assertSupplierExists(id: string) {
    const data = await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('Supplier not found');
  }

  private async assertUomExists(id: string) {
    const data = await this.prisma.unitOfMeasure.findUnique({ where: { id }, select: { id: true } });
    if (!data) throw new NotFoundException('UOM not found');
  }

  private async assertActiveUom(id: string) {
    const data = await this.prisma.unitOfMeasure.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!data || !data.isActive) throw new BadRequestException('UOM not found or inactive');
  }

  private async assertSuppliersBelongToCustomer(customerId: string, supplierIds: string[]) {
    const uniqueIds = [...new Set(supplierIds)];
    if (uniqueIds.length === 0) return;
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        id: { in: uniqueIds },
        customerId,
        isActive: true,
      },
      select: { id: true },
    });
    if (suppliers.length !== uniqueIds.length) {
      throw new BadRequestException('One or more suppliers are invalid for this customer');
    }
  }

  private isSystemAdministrator(user?: JwtPayload): boolean {
    return Boolean(user?.roles?.includes('SYSTEM_ADMIN'));
  }

  private operatorScopeFilter(user?: JwtPayload): string | null | undefined {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    if (user.operatorCompanyId) return user.operatorCompanyId;
    return null;
  }

  private allowedWarehouseIds(user?: JwtPayload): string[] | undefined {
    if (!user || this.isSystemAdministrator(user)) return undefined;
    return user.warehouseIds ?? [];
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

  private assertSystemAdministratorOnly(user: JwtPayload | undefined, message: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    throwScopeForbidden('FORBIDDEN_SCOPE_SYSTEM_ADMIN_REQUIRED', message);
  }

  private assertUserAllowedOperator(user: JwtPayload | undefined, operatorCompanyId?: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const scopedOperatorId = user.operatorCompanyId ?? undefined;
    if (!scopedOperatorId) {
      throwScopeForbidden('MISSING_SCOPE_OPERATOR', 'User has no operator scope');
    }
    if (operatorCompanyId && operatorCompanyId !== scopedOperatorId) {
      throwScopeForbidden('FORBIDDEN_SCOPE_OPERATOR', 'User is not allowed to access this operator company');
    }
  }

  /**
   * Warehouse: owner (aset) vs operator (3PL) may differ. Scoped users must act as the **operator**
   * when a separate operator company is set; otherwise the warehouse is treated as self-operated
   * and their scope must match the owner.
   */
  private assertUserAllowedWarehouseOwnerOperator(
    user: JwtPayload | undefined,
    p: { ownerCompanyId: string; operatorCompanyId: string | null | undefined },
  ) {
    if (!user || this.isSystemAdministrator(user)) return;
    const scoped = user.operatorCompanyId ?? undefined;
    if (!scoped) {
      throwScopeForbidden('MISSING_SCOPE_OPERATOR', 'User has no operator scope');
    }
    if (p.operatorCompanyId) {
      if (p.operatorCompanyId !== scoped) {
        throwScopeForbidden(
          'FORBIDDEN_SCOPE_OPERATOR',
          'Pengelola (operator) warehouse harus sesuai scope operator Anda',
        );
      }
      return;
    }
    if (p.ownerCompanyId !== scoped) {
      throwScopeForbidden(
        'FORBIDDEN_SCOPE_OPERATOR',
        'Kosongkan operator bila gudang dioperasikan sendiri; owner harus sesuai scope operator Anda',
      );
    }
  }

  private assertUserAllowedWarehouse(user: JwtPayload | undefined, warehouseId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const allowed = new Set(user.warehouseIds ?? []);
    if (!allowed.has(warehouseId)) {
      throwScopeForbidden('FORBIDDEN_SCOPE_WAREHOUSE', 'User is not allowed to access this warehouse');
    }
  }

  private async assertUserAllowedWarehouseById(user: JwtPayload | undefined, warehouseId: string) {
    this.assertUserAllowedWarehouse(user, warehouseId);
  }

  private async assertUserAllowedWarehouseByAreaId(user: JwtPayload | undefined, areaId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const area = await this.prisma.warehouseArea.findUnique({
      where: { id: areaId },
      select: { warehouseId: true },
    });
    if (!area) throw new NotFoundException('Area not found');
    this.assertUserAllowedWarehouse(user, area.warehouseId);
  }

  private async assertUserAllowedWarehouseByZoneId(user: JwtPayload | undefined, zoneId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const zone = await this.prisma.warehouseZone.findUnique({
      where: { id: zoneId },
      select: { warehouseId: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    this.assertUserAllowedWarehouse(user, zone.warehouseId);
  }

  private async assertUserAllowedWarehouseByBinId(user: JwtPayload | undefined, binId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const bin = await this.prisma.warehouseBin.findUnique({
      where: { id: binId },
      select: { warehouseId: true },
    });
    if (!bin) throw new NotFoundException('Bin not found');
    this.assertUserAllowedWarehouse(user, bin.warehouseId);
  }

  private async assertUserAllowedCustomer(user: JwtPayload | undefined, customerId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const allowedCustomerIds = await this.allowedCustomerIdsForUser(user);
    if (!allowedCustomerIds || allowedCustomerIds.includes(customerId)) return;
    throwScopeForbidden('FORBIDDEN_SCOPE_CUSTOMER', 'User is not allowed to access this customer');
  }

  private async assertUserAllowedCustomerByCustomerId(user: JwtPayload | undefined, customerId: string) {
    await this.assertUserAllowedCustomer(user, customerId);
  }

  private async assertUserAllowedCustomerByProductId(user: JwtPayload | undefined, productId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { customerId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.assertUserAllowedCustomer(user, product.customerId);
  }

  private async assertUserAllowedCustomerBySupplierId(user: JwtPayload | undefined, supplierId: string) {
    if (!user || this.isSystemAdministrator(user)) return;
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { customerId: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    await this.assertUserAllowedCustomer(user, supplier.customerId);
  }

  private rethrowKnownConstraint(err: unknown, message: string): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw err;
  }
}
