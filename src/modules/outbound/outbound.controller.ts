import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CompleteOutboundTaskDto } from './dto/complete-outbound-task.dto';
import { CreateOutboundTaskDto } from './dto/create-outbound-task.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { CreateWaveDto } from './dto/create-wave.dto';
import { UpdateOutboundTaskDto } from './dto/update-outbound-task.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { UpdateSalesOrderItemsDto } from './dto/update-sales-order-items.dto';
import { UpdateWaveDto } from './dto/update-wave.dto';
import { OutboundService } from './outbound.service';

@ApiTags('outbound')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outbound')
export class OutboundController {
  constructor(private readonly service: OutboundService) {}

  @Get('sales-orders')
  @ApiOperation({ summary: 'List sales orders with items and task progress' })
  listSalesOrders(@CurrentUser() user: JwtPayload) {
    return this.service.listSalesOrders(user);
  }

  @Post('sales-orders')
  @ApiOperation({ summary: 'Create sales order (outbound demand)' })
  createSalesOrder(@Body() dto: CreateSalesOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.createSalesOrder(dto, user);
  }

  @Patch('sales-orders/:id')
  @ApiOperation({ summary: 'Update sales order header/status' })
  updateSalesOrder(@Param('id') id: string, @Body() dto: UpdateSalesOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateSalesOrder(id, dto, user);
  }

  @Patch('sales-orders/:id/items')
  @ApiOperation({ summary: 'Replace sales order items (only for draft/released)' })
  updateSalesOrderItems(@Param('id') id: string, @Body() dto: UpdateSalesOrderItemsDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateSalesOrderItems(id, dto, user);
  }

  @Delete('sales-orders/:id')
  @ApiOperation({ summary: 'Soft delete sales order (set status CANCELLED)' })
  deleteSalesOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDeleteSalesOrder(id, user);
  }

  @Post('sales-orders/:id/allocate')
  @ApiOperation({ summary: 'Auto allocate inventory for sales order' })
  allocateSalesOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.allocateSalesOrder(id, user);
  }

  @Post('sales-orders/:id/reallocate')
  @ApiOperation({ summary: 'Reallocate inventory by recreating outbound allocations' })
  reallocateSalesOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reallocateSalesOrder(id, user);
  }

  @Get('waves')
  @ApiOperation({ summary: 'List outbound waves' })
  listWaves(@CurrentUser() user: JwtPayload) {
    return this.service.listWaves(user);
  }

  @Post('waves')
  @ApiOperation({ summary: 'Create wave for sales order' })
  createWave(@Body() dto: CreateWaveDto, @CurrentUser() user: JwtPayload) {
    return this.service.createWave(dto, user);
  }

  @Patch('waves/:id')
  @ApiOperation({ summary: 'Update wave planning time' })
  updateWave(@Param('id') id: string, @Body() dto: UpdateWaveDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateWave(id, dto, user);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List outbound tasks by status/order' })
  listTasks(@CurrentUser() user: JwtPayload, @Query('salesOrderId') salesOrderId?: string, @Query('status') status?: string) {
    return this.service.listTasks(user, salesOrderId, status);
  }

  @Get('events')
  @ApiOperation({ summary: 'List outbound event logs by sales order/task' })
  listEvents(
    @CurrentUser() user: JwtPayload,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('outboundTaskId') outboundTaskId?: string,
    @Query('eventCode') eventCode?: string,
  ) {
    return this.service.listEvents(user, salesOrderId, outboundTaskId, eventCode);
  }

  @Get('serial-reservations')
  @ApiOperation({ summary: 'List outbound serial reservations for planning/task governance' })
  listSerialReservations(
    @CurrentUser() user: JwtPayload,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('waveId') waveId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listSerialReservations(user, salesOrderId, waveId, status);
  }

  @Get('allocations')
  @ApiOperation({ summary: 'List outbound allocations by sales order' })
  listAllocations(@CurrentUser() user: JwtPayload, @Query('salesOrderId') salesOrderId?: string) {
    return this.service.listAllocations(user, salesOrderId);
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Create outbound task (picking/packing/loading)' })
  createTask(@Body() dto: CreateOutboundTaskDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTask(dto, user);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update outbound task assignment/status' })
  updateTask(@Param('id') id: string, @Body() dto: UpdateOutboundTaskDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateTask(id, dto, user);
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Soft delete task (set status CANCELLED)' })
  deleteTask(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDeleteTask(id, user);
  }

  @Patch('tasks/:id/complete')
  @ApiOperation({ summary: 'Complete outbound task and update SO progress' })
  completeTask(@Param('id') id: string, @Body() dto: CompleteOutboundTaskDto, @CurrentUser() user: JwtPayload) {
    return this.service.completeTask(id, dto, user);
  }
}
