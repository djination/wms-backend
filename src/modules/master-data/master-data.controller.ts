import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateAreaDto } from './dto/create-area.dto';
import { AssignWarehouseCustomersDto } from './dto/assign-warehouse-customers.dto';
import { CreateBinDto } from './dto/create-bin.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateOperatorCompanyDto } from './dto/create-operator-company.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { DeleteMasterDataDto, DeleteMode } from './dto/delete-master-data.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { UpdateBinDto } from './dto/update-bin.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateOperatorCompanyDto } from './dto/update-operator-company.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { UpsertInventoryDto } from './dto/upsert-inventory.dto';
import { MasterDataService } from './master-data.service';

@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get('customers')
  @ApiOperation({ summary: 'List customers' })
  listCustomers(@CurrentUser() user: JwtPayload) {
    return this.service.listCustomers(user);
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create customer' })
  createCustomer(@Body() dto: CreateCustomerDto, @CurrentUser() user: JwtPayload) {
    return this.service.createCustomer(dto, user);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Update customer' })
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateCustomer(id, dto, user);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: 'Delete customer (soft/hard)' })
  deleteCustomer(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteCustomer(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('operators')
  @ApiOperation({ summary: 'List operator companies' })
  listOperators(@CurrentUser() user: JwtPayload) {
    return this.service.listOperatorCompanies(user);
  }

  @Post('operators')
  @ApiOperation({ summary: 'Create operator company' })
  createOperator(@Body() dto: CreateOperatorCompanyDto, @CurrentUser() user: JwtPayload) {
    return this.service.createOperatorCompany(dto, user);
  }

  @Patch('operators/:id')
  @ApiOperation({ summary: 'Update operator company' })
  updateOperator(@Param('id') id: string, @Body() dto: UpdateOperatorCompanyDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateOperatorCompany(id, dto, user);
  }

  @Delete('operators/:id')
  @ApiOperation({ summary: 'Delete operator company (soft/hard)' })
  deleteOperator(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteOperatorCompany(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'List warehouses with customer/operator mapping' })
  listWarehouses(@CurrentUser() user: JwtPayload) {
    return this.service.listWarehouses(user);
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Create warehouse and map owner/operator/customer' })
  createWarehouse(@Body() dto: CreateWarehouseDto, @CurrentUser() user: JwtPayload) {
    return this.service.createWarehouse(dto, user);
  }

  @Post('warehouses/assign-customers')
  @ApiOperation({ summary: 'Assign multiple customers to shared warehouse' })
  assignWarehouseCustomers(@Body() dto: AssignWarehouseCustomersDto, @CurrentUser() user: JwtPayload) {
    return this.service.assignWarehouseCustomers(dto, user);
  }

  @Patch('warehouses/:id')
  @ApiOperation({ summary: 'Update warehouse' })
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateWarehouse(id, dto, user);
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'Delete warehouse (soft/hard)' })
  deleteWarehouse(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteWarehouse(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('areas')
  @ApiOperation({ summary: 'List warehouse areas' })
  listAreas(@CurrentUser() user: JwtPayload) {
    return this.service.listAreas(user);
  }

  @Post('areas')
  @ApiOperation({ summary: 'Create area inside warehouse' })
  createArea(@Body() dto: CreateAreaDto, @CurrentUser() user: JwtPayload) {
    return this.service.createArea(dto, user);
  }

  @Patch('areas/:id')
  @ApiOperation({ summary: 'Update area' })
  updateArea(@Param('id') id: string, @Body() dto: UpdateAreaDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateArea(id, dto, user);
  }

  @Delete('areas/:id')
  @ApiOperation({ summary: 'Delete area (soft/hard)' })
  deleteArea(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteArea(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('zones')
  @ApiOperation({ summary: 'List warehouse zones' })
  listZones(@CurrentUser() user: JwtPayload) {
    return this.service.listZones(user);
  }

  @Post('zones')
  @ApiOperation({ summary: 'Create zone inside warehouse/area' })
  createZone(@Body() dto: CreateZoneDto, @CurrentUser() user: JwtPayload) {
    return this.service.createZone(dto, user);
  }

  @Patch('zones/:id')
  @ApiOperation({ summary: 'Update zone' })
  updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateZone(id, dto, user);
  }

  @Delete('zones/:id')
  @ApiOperation({ summary: 'Delete zone (soft/hard)' })
  deleteZone(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteZone(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('bins')
  @ApiOperation({ summary: 'List warehouse bins' })
  listBins(@CurrentUser() user: JwtPayload) {
    return this.service.listBins(user);
  }

  @Post('bins')
  @ApiOperation({ summary: 'Create bin inside warehouse zone' })
  createBin(@Body() dto: CreateBinDto, @CurrentUser() user: JwtPayload) {
    return this.service.createBin(dto, user);
  }

  @Patch('bins/:id')
  @ApiOperation({ summary: 'Update bin' })
  updateBin(@Param('id') id: string, @Body() dto: UpdateBinDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateBin(id, dto, user);
  }

  @Delete('bins/:id')
  @ApiOperation({ summary: 'Delete bin (soft/hard)' })
  deleteBin(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteBin(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('products')
  @ApiOperation({ summary: 'List customer products' })
  listProducts(@CurrentUser() user: JwtPayload) {
    return this.service.listProducts(user);
  }

  @Get('uoms')
  @ApiOperation({ summary: 'List unit of measures' })
  listUoms(@CurrentUser() user: JwtPayload) {
    return this.service.listUoms(user);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List customer suppliers' })
  listSuppliers(@CurrentUser() user: JwtPayload) {
    return this.service.listSuppliers(user);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create product under customer ownership' })
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.service.createProduct(dto, user);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create supplier under customer ownership' })
  createSupplier(@Body() dto: CreateSupplierDto, @CurrentUser() user: JwtPayload) {
    return this.service.createSupplier(dto, user);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product (name/sku/active status)' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateProduct(id, dto, user);
  }

  @Post('uoms')
  @ApiOperation({ summary: 'Create unit of measure' })
  createUom(@Body() dto: CreateUomDto, @CurrentUser() user: JwtPayload) {
    return this.service.createUom(dto, user);
  }

  @Patch('uoms/:id')
  @ApiOperation({ summary: 'Update unit of measure' })
  updateUom(@Param('id') id: string, @Body() dto: UpdateUomDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateUom(id, dto, user);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: 'Update supplier (code/name/active status)' })
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateSupplier(id, dto, user);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete product (soft/hard)' })
  deleteProduct(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteProduct(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Delete('suppliers/:id')
  @ApiOperation({ summary: 'Delete supplier (soft/hard)' })
  deleteSupplier(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteSupplier(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Delete('uoms/:id')
  @ApiOperation({ summary: 'Delete unit of measure (soft/hard)' })
  deleteUom(@Param('id') id: string, @Query() query: DeleteMasterDataDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteUom(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('inventory-balances')
  @ApiOperation({ summary: 'List inventory balance by customer/warehouse/bin/product' })
  listInventoryBalances(@CurrentUser() user: JwtPayload) {
    return this.service.listInventoryBalances(user);
  }

  @Post('inventory-balances')
  @ApiOperation({ summary: 'Set on-hand quantity for a customer product in a bin' })
  upsertInventoryBalance(@Body() dto: UpsertInventoryDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsertInventoryBalance(dto, user);
  }
}
