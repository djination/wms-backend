import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateAsnDto } from './dto/create-asn.dto';
import { ReceiveAsnItemDto } from './dto/receive-asn-item.dto';
import { UpdateAsnDto } from './dto/update-asn.dto';
import { UpdateAsnItemsDto } from './dto/update-asn-items.dto';
import { InboundService } from './inbound.service';

@ApiTags('inbound')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inbound')
export class InboundController {
  constructor(private readonly service: InboundService) {}

  @Get('asns')
  @ApiOperation({ summary: 'List ASN and receiving progress' })
  listAsns(@CurrentUser() user: JwtPayload) {
    return this.service.listAsns(user);
  }

  @Post('asns')
  @ApiOperation({ summary: 'Create ASN (advance shipment notification)' })
  createAsn(@Body() dto: CreateAsnDto, @CurrentUser() user: JwtPayload) {
    return this.service.createAsn(dto, user);
  }

  @Patch('asns/:id')
  @ApiOperation({ summary: 'Update ASN header/status' })
  updateAsn(@Param('id') id: string, @Body() dto: UpdateAsnDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateAsn(id, dto, user);
  }

  @Patch('asns/:id/items')
  @ApiOperation({ summary: 'Replace ASN items (only for draft ASN)' })
  updateAsnItems(@Param('id') id: string, @Body() dto: UpdateAsnItemsDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateAsnItems(id, dto, user);
  }

  @Delete('asns/:id')
  @ApiOperation({ summary: 'Soft delete ASN (set status CANCELLED)' })
  deleteAsn(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDeleteAsn(id, user);
  }

  @Post('receive')
  @ApiOperation({ summary: 'Receive ASN item into bin and update stock balance' })
  receive(@Body() dto: ReceiveAsnItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.receiveItem(dto, user);
  }
}
