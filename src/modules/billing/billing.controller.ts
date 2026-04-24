import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BillingService } from './billing.service';
import { BillingSummaryQueryDto } from './dto/billing-summary-query.dto';
import { CreateBillingContractDto } from './dto/create-billing-contract.dto';
import { CreateBillingRateDto } from './dto/create-billing-rate.dto';
import { CreateBillingTransactionDto } from './dto/create-billing-transaction.dto';
import { DeleteBillingEntityDto, DeleteMode } from './dto/delete-billing-entity.dto';
import { UpdateBillingContractDto } from './dto/update-billing-contract.dto';
import { UpdateBillingRateDto } from './dto/update-billing-rate.dto';
import { UpdateBillingTransactionDto } from './dto/update-billing-transaction.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('contracts')
  @ApiOperation({ summary: 'List billing contracts by customer' })
  listContracts(@CurrentUser() user: JwtPayload, @Query('customerId') customerId?: string) {
    return this.service.listContracts(user, customerId);
  }

  @Post('contracts')
  @ApiOperation({ summary: 'Create customer billing contract' })
  createContract(@Body() dto: CreateBillingContractDto, @CurrentUser() user: JwtPayload) {
    return this.service.createContract(dto, user);
  }

  @Patch('contracts/:id')
  @ApiOperation({ summary: 'Update billing contract' })
  updateContract(@Param('id') id: string, @Body() dto: UpdateBillingContractDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateContract(id, dto, user);
  }

  @Delete('contracts/:id')
  @ApiOperation({ summary: 'Delete billing contract (soft/hard)' })
  deleteContract(@Param('id') id: string, @Query() query: DeleteBillingEntityDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteContract(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('rates')
  @ApiOperation({ summary: 'List billing rates by contract' })
  listRates(@CurrentUser() user: JwtPayload, @Query('contractId') contractId?: string) {
    return this.service.listRates(user, contractId);
  }

  @Post('rates')
  @ApiOperation({ summary: 'Create billing rate for contract and activity' })
  createRate(@Body() dto: CreateBillingRateDto, @CurrentUser() user: JwtPayload) {
    return this.service.createRate(dto, user);
  }

  @Patch('rates/:id')
  @ApiOperation({ summary: 'Update billing rate' })
  updateRate(@Param('id') id: string, @Body() dto: UpdateBillingRateDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateRate(id, dto, user);
  }

  @Delete('rates/:id')
  @ApiOperation({ summary: 'Delete billing rate (soft/hard)' })
  deleteRate(@Param('id') id: string, @Query() query: DeleteBillingEntityDto, @CurrentUser() user: JwtPayload) {
    return this.service.deleteRate(id, query.mode ?? DeleteMode.SOFT, user);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List billing transactions filtered by customer/period' })
  listTransactions(@CurrentUser() user: JwtPayload, @Query('customerId') customerId?: string, @Query('periodKey') periodKey?: string) {
    return this.service.listTransactions(user, customerId, periodKey);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create billing transaction line (manual or integration source)' })
  createTransaction(@Body() dto: CreateBillingTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.createTransaction(dto, user);
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Update billing transaction' })
  updateTransaction(@Param('id') id: string, @Body() dto: UpdateBillingTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateTransaction(id, dto, user);
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Soft delete billing transaction' })
  deleteTransaction(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDeleteTransaction(id, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Billing summary by customer and period key' })
  getSummary(@Query() query: BillingSummaryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.getSummary(query, user);
  }
}
