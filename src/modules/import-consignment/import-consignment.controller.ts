import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateImportConsignmentDto } from './dto/create-import-consignment.dto';
import { UpdateImportConsignmentDto } from './dto/update-import-consignment.dto';
import { RegisterImportConsignmentDocumentDto } from './dto/register-import-consignment-document.dto';
import { UpdateManifestReviewDto } from './dto/update-manifest-review.dto';
import { ImportConsignmentService } from './import-consignment.service';

@ApiTags('import-consignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import-consignments')
export class ImportConsignmentController {
  constructor(private readonly service: ImportConsignmentService) {}

  @Get()
  @ApiOperation({ summary: 'List import consignments (manifest header)' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('customerId') customerId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.list(user, { customerId, warehouseId });
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Daftar dokumen lampiran + URL unduh (signed, sementara)' })
  listDocuments(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.listDocuments(id, user);
  }

  @Post(':id/documents')
  @ApiOperation({
    summary: 'Daftarkan file ke konsignment (unggah dulu POST /upload, lalu kirim key di body)',
  })
  registerDocument(
    @Param('id') id: string,
    @Body() dto: RegisterImportConsignmentDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.registerDocument(id, dto, user);
  }

  @Delete(':id/documents/:docId')
  @ApiOperation({ summary: 'Hapus metadata dokumen (file di storage tidak dihapus otomatis)' })
  deleteDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deleteDocument(id, docId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consignment with manifest review and ASN links' })
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getById(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create consignment + draft manifest review' })
  create(@Body() dto: CreateImportConsignmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update AWB fields / master ref / ASN links' })
  update(@Param('id') id: string, @Body() dto: UpdateImportConsignmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/manifest-review')
  @ApiOperation({ summary: 'Update manifest review status, notes, findings (gate untuk customs release)' })
  updateManifestReview(
    @Param('id') id: string,
    @Body() dto: UpdateManifestReviewDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateManifestReview(id, dto, user);
  }
}
