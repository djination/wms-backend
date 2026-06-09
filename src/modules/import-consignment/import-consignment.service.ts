import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ImportConsignmentDocType,
  ManifestReviewStatus,
  Prisma,
  WarehouseType,
} from '@prisma/client';
import { throwScopeForbidden } from '../../common/errors/scope-error';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  OBJECT_STORAGE,
  ObjectStoragePort,
} from '../storage/ports/object-storage.port';
import { CreateImportConsignmentDto } from './dto/create-import-consignment.dto';
import { RegisterImportConsignmentDocumentDto } from './dto/register-import-consignment-document.dto';
import { UpdateImportConsignmentDto } from './dto/update-import-consignment.dto';
import { UpdateManifestReviewDto } from './dto/update-manifest-review.dto';

@Injectable()
export class ImportConsignmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStoragePort,
  ) {}

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

  /**
   * Gate untuk customs release: gudang transit + requireManifestReviewGate + ASN terikat + status MATCHED|WAIVED.
   */
  async assertCustomsReleaseAllowedForReceipt(
    tx: Prisma.TransactionClient,
    params: { warehouseId: string; inboundAsnId: string },
  ): Promise<void> {
    const wh = await tx.warehouse.findUnique({
      where: { id: params.warehouseId },
      select: { isTransitImportHub: true, requireManifestReviewGate: true },
    });
    if (!wh?.isTransitImportHub || !wh.requireManifestReviewGate) {
      return;
    }
    const link = await tx.importConsignmentAsn.findUnique({
      where: { inboundAsnId: params.inboundAsnId },
      select: { importConsignmentId: true },
    });
    if (!link) {
      throw new BadRequestException(
        'Manifest review gate: hubungkan ASN ini ke import consignment sebelum customs release',
      );
    }
    const review = await tx.manifestReview.findUnique({
      where: { importConsignmentId: link.importConsignmentId },
      select: { status: true },
    });
    if (!review) {
      throw new BadRequestException('Manifest review tidak ditemukan untuk consignment');
    }
    if (review.status !== ManifestReviewStatus.MATCHED && review.status !== ManifestReviewStatus.WAIVED) {
      throw new BadRequestException(
        `Manifest review harus MATCHED atau WAIVED sebelum customs release (saat ini: ${review.status})`,
      );
    }
  }

  async list(
    user: JwtPayload | undefined,
    query: { customerId?: string; warehouseId?: string },
  ) {
    const allowed = this.allowedWarehouseIds(user);
    if (allowed !== undefined && allowed.length === 0) return [];
    if (query.warehouseId && allowed !== undefined && !allowed.includes(query.warehouseId)) {
      return [];
    }
    const warehouseFilter: Prisma.StringFilter | string | undefined =
      query.warehouseId != null
        ? query.warehouseId
        : allowed != null
          ? { in: allowed }
          : undefined;
    return this.prisma.importConsignment.findMany({
      where: {
        customerId: query.customerId,
        ...(warehouseFilter !== undefined ? { warehouseId: warehouseFilter } : {}),
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        asnLinks: {
          include: {
            inboundAsn: { select: { id: true, asnNo: true, referenceNo: true, status: true } },
          },
        },
        manifestReview: {
          include: {
            findings: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, user?: JwtPayload) {
    const row = await this.prisma.importConsignment.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!row) throw new NotFoundException('Import consignment not found');
    this.assertWarehouseAllowed(user, row.warehouseId);
    return this.finalizeConsignmentRow(row);
  }

  async listDocuments(consignmentId: string, user?: JwtPayload) {
    const consignment = await this.prisma.importConsignment.findUnique({
      where: { id: consignmentId },
      select: { warehouseId: true },
    });
    if (!consignment) throw new NotFoundException('Import consignment not found');
    this.assertWarehouseAllowed(user, consignment.warehouseId);
    const docs = await this.prisma.importConsignmentDocument.findMany({
      where: { importConsignmentId: consignmentId },
      orderBy: { createdAt: 'desc' },
    });
    return this.mapDocumentsForResponse(docs);
  }

  async registerDocument(
    consignmentId: string,
    dto: RegisterImportConsignmentDocumentDto,
    user?: JwtPayload,
  ) {
    const consignment = await this.prisma.importConsignment.findUnique({
      where: { id: consignmentId },
      select: { warehouseId: true },
    });
    if (!consignment) throw new NotFoundException('Import consignment not found');
    this.assertWarehouseAllowed(user, consignment.warehouseId);
    const key = dto.storageKey.trim();
    this.assertStorageKeyOwnedByUser(key, user?.sub);

    const created = await this.prisma.importConsignmentDocument.create({
      data: {
        importConsignmentId: consignmentId,
        docType: dto.docType,
        originalFileName: dto.originalFileName.trim().slice(0, 500),
        storageKey: key,
        contentType: dto.contentType?.trim() ? dto.contentType.trim().slice(0, 120) : null,
        uploadedById: user?.sub ?? null,
      },
    });
    const [mapped] = await this.mapDocumentsForResponse([created]);
    return mapped;
  }

  async deleteDocument(consignmentId: string, documentId: string, user?: JwtPayload) {
    const doc = await this.prisma.importConsignmentDocument.findUnique({
      where: { id: documentId },
      select: { id: true, importConsignmentId: true },
    });
    if (!doc || doc.importConsignmentId !== consignmentId) {
      throw new NotFoundException('Document not found');
    }
    const consignment = await this.prisma.importConsignment.findUnique({
      where: { id: consignmentId },
      select: { warehouseId: true },
    });
    if (!consignment) throw new NotFoundException('Import consignment not found');
    this.assertWarehouseAllowed(user, consignment.warehouseId);
    await this.prisma.importConsignmentDocument.delete({ where: { id: documentId } });
    return { success: true, id: documentId };
  }

  async create(dto: CreateImportConsignmentDto, user?: JwtPayload) {
    this.assertWarehouseAllowed(user, dto.warehouseId);
    await this.assertCustomerWarehouseForConsignment(dto.customerId, dto.warehouseId);

    const asnIds = dto.inboundAsnIds ?? [];
    if (asnIds.length > 0) {
      await this.validateAsnLinks(this.prisma, dto.customerId, dto.warehouseId, asnIds, undefined);
    }

    const consignmentNo =
      dto.consignmentNo?.trim().toUpperCase() ?? (await this.generateConsignmentNo(this.prisma));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.importConsignment.create({
          data: {
            consignmentNo,
            customerId: dto.customerId,
            warehouseId: dto.warehouseId,
            masterRef: dto.masterRef?.trim() || null,
            ...this.awbScalarsFromCreateDto(dto),
            asnLinks:
              asnIds.length > 0
                ? {
                    create: asnIds.map((inboundAsnId) => ({ inboundAsnId })),
                  }
                : undefined,
            manifestReview: {
              create: {
                status: ManifestReviewStatus.DRAFT,
              },
            },
          },
          include: this.detailInclude(),
        });
        return this.finalizeConsignmentRow(created);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Consignment number already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateImportConsignmentDto, user?: JwtPayload) {
    const existing = await this.prisma.importConsignment.findUnique({
      where: { id },
      select: { id: true, warehouseId: true, customerId: true },
    });
    if (!existing) throw new NotFoundException('Import consignment not found');
    this.assertWarehouseAllowed(user, existing.warehouseId);

    if (dto.inboundAsnIds !== undefined) {
      await this.validateAsnLinks(
        this.prisma,
        existing.customerId,
        existing.warehouseId,
        dto.inboundAsnIds,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.inboundAsnIds !== undefined) {
        await tx.importConsignmentAsn.deleteMany({ where: { importConsignmentId: id } });
        if (dto.inboundAsnIds.length > 0) {
          await tx.importConsignmentAsn.createMany({
            data: dto.inboundAsnIds.map((inboundAsnId) => ({
              importConsignmentId: id,
              inboundAsnId,
            })),
          });
        }
      }

      const data: Prisma.ImportConsignmentUpdateInput = {};
      if (dto.masterRef !== undefined) data.masterRef = dto.masterRef.trim() || null;
      this.patchAwbFields(data, dto);

      const updated = await tx.importConsignment.update({
        where: { id },
        data,
        include: this.detailInclude(),
      });
      return this.finalizeConsignmentRow(updated);
    });
  }

  async updateManifestReview(consignmentId: string, dto: UpdateManifestReviewDto, user?: JwtPayload) {
    const consignment = await this.prisma.importConsignment.findUnique({
      where: { id: consignmentId },
      select: { warehouseId: true, manifestReview: { select: { id: true } } },
    });
    if (!consignment) throw new NotFoundException('Import consignment not found');
    this.assertWarehouseAllowed(user, consignment.warehouseId);
    if (!consignment.manifestReview) {
      throw new BadRequestException('Manifest review record missing');
    }

    if (dto.status === ManifestReviewStatus.WAIVED) {
      const reason = dto.waivedReason?.trim();
      if (!reason) {
        throw new BadRequestException('waivedReason is required when status is WAIVED');
      }
    }

    const now = new Date();
    const userId = user?.sub;

    const reviewUpdate: Prisma.ManifestReviewUncheckedUpdateInput = {
      status: dto.status,
    };
    if (dto.notes !== undefined) {
      reviewUpdate.notes = dto.notes.trim() || null;
    }

    if (dto.status === ManifestReviewStatus.MATCHED || dto.status === ManifestReviewStatus.WAIVED) {
      reviewUpdate.reviewedAt = now;
      reviewUpdate.reviewedById = userId ?? null;
    } else {
      reviewUpdate.reviewedAt = null;
      reviewUpdate.reviewedById = null;
    }

    if (dto.status === ManifestReviewStatus.WAIVED) {
      reviewUpdate.waivedReason = dto.waivedReason!.trim();
      reviewUpdate.waivedAt = now;
      reviewUpdate.waivedById = userId ?? null;
    } else {
      reviewUpdate.waivedReason = null;
      reviewUpdate.waivedAt = null;
      reviewUpdate.waivedById = null;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.manifestReview.update({
        where: { id: consignment.manifestReview!.id },
        data: reviewUpdate,
      });

      if (dto.findings !== undefined) {
        await tx.manifestReviewFinding.deleteMany({
          where: { manifestReviewId: consignment.manifestReview!.id },
        });
        if (dto.findings.length > 0) {
          await tx.manifestReviewFinding.createMany({
            data: dto.findings.map((f, idx) => ({
              manifestReviewId: consignment.manifestReview!.id,
              category: f.category,
              message: f.message.trim(),
              sortOrder: f.sortOrder ?? idx,
            })),
          });
        }
      }

      const row = await tx.importConsignment.findUnique({
        where: { id: consignmentId },
        include: this.detailInclude(),
      });
      if (!row) throw new NotFoundException('Import consignment not found');
      return this.finalizeConsignmentRow(row);
    });
  }

  private assertStorageKeyOwnedByUser(storageKey: string, userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException('Autentikasi diperlukan untuk mendaftarkan dokumen');
    }
    const prefix = `uploads/${userId}/`;
    if (!storageKey.startsWith(prefix)) {
      throw new BadRequestException('storageKey harus dari unggahan Anda (POST /upload dengan token yang sama)');
    }
  }

  private async mapDocumentsForResponse(
    docs: Array<{
      id: string;
      docType: ImportConsignmentDocType;
      originalFileName: string;
      storageKey: string;
      contentType: string | null;
      createdAt: Date;
    }>,
  ) {
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        docType: d.docType,
        originalFileName: d.originalFileName,
        contentType: d.contentType,
        createdAt: d.createdAt,
        downloadUrl: await this.objectStorage.getSignedGetUrl(d.storageKey, 3600),
      })),
    );
  }

  private async finalizeConsignmentRow(
    row: Record<string, unknown> & {
      documents?: Array<{
        id: string;
        docType: ImportConsignmentDocType;
        originalFileName: string;
        storageKey: string;
        contentType: string | null;
        createdAt: Date;
      }>;
    },
  ) {
    const docs = row.documents ?? [];
    return {
      ...row,
      documents: await this.mapDocumentsForResponse(docs),
    };
  }

  private detailInclude(): Prisma.ImportConsignmentInclude {
    return {
      customer: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      asnLinks: {
        include: {
          inboundAsn: { select: { id: true, asnNo: true, referenceNo: true, status: true } },
        },
      },
      documents: {
        orderBy: { createdAt: 'desc' },
      },
      manifestReview: {
        include: {
          findings: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          reviewedBy: { select: { id: true, name: true, email: true } },
          waivedBy: { select: { id: true, name: true, email: true } },
        },
      },
    };
  }

  private async generateConsignmentNo(db: PrismaService | Prisma.TransactionClient): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `IC-${day}`;
    const count = await db.importConsignment.count({
      where: { consignmentNo: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private awbScalarsFromCreateDto(dto: CreateImportConsignmentDto): Pick<
    Prisma.ImportConsignmentUncheckedCreateInput,
    | 'awbMawb'
    | 'awbHawb'
    | 'awbCarrier'
    | 'awbFlight'
    | 'awbOrigin'
    | 'awbDestination'
    | 'awbShipper'
    | 'awbConsignee'
    | 'awbPieces'
    | 'awbGrossWeightKg'
    | 'awbChargeableWeightKg'
    | 'awbNatureOfGoods'
  > {
    return {
      awbMawb: dto.awbMawb?.trim() || null,
      awbHawb: dto.awbHawb?.trim() || null,
      awbCarrier: dto.awbCarrier?.trim() || null,
      awbFlight: dto.awbFlight?.trim() || null,
      awbOrigin: dto.awbOrigin?.trim() || null,
      awbDestination: dto.awbDestination?.trim() || null,
      awbShipper: dto.awbShipper?.trim() || null,
      awbConsignee: dto.awbConsignee?.trim() || null,
      awbPieces: dto.awbPieces ?? null,
      awbGrossWeightKg:
        dto.awbGrossWeightKg != null ? new Prisma.Decimal(dto.awbGrossWeightKg) : null,
      awbChargeableWeightKg:
        dto.awbChargeableWeightKg != null ? new Prisma.Decimal(dto.awbChargeableWeightKg) : null,
      awbNatureOfGoods: dto.awbNatureOfGoods?.trim() || null,
    };
  }

  private patchAwbFields(data: Prisma.ImportConsignmentUpdateInput, dto: UpdateImportConsignmentDto) {
    const str = (v?: string) => (v !== undefined ? (v.trim() || null) : undefined);
    if (dto.awbMawb !== undefined) data.awbMawb = str(dto.awbMawb);
    if (dto.awbHawb !== undefined) data.awbHawb = str(dto.awbHawb);
    if (dto.awbCarrier !== undefined) data.awbCarrier = str(dto.awbCarrier);
    if (dto.awbFlight !== undefined) data.awbFlight = str(dto.awbFlight);
    if (dto.awbOrigin !== undefined) data.awbOrigin = str(dto.awbOrigin);
    if (dto.awbDestination !== undefined) data.awbDestination = str(dto.awbDestination);
    if (dto.awbShipper !== undefined) data.awbShipper = str(dto.awbShipper);
    if (dto.awbConsignee !== undefined) data.awbConsignee = str(dto.awbConsignee);
    if (dto.awbPieces !== undefined) data.awbPieces = dto.awbPieces;
    if (dto.awbGrossWeightKg !== undefined) {
      data.awbGrossWeightKg =
        dto.awbGrossWeightKg != null ? new Prisma.Decimal(dto.awbGrossWeightKg) : null;
    }
    if (dto.awbChargeableWeightKg !== undefined) {
      data.awbChargeableWeightKg =
        dto.awbChargeableWeightKg != null ? new Prisma.Decimal(dto.awbChargeableWeightKg) : null;
    }
    if (dto.awbNatureOfGoods !== undefined) data.awbNatureOfGoods = str(dto.awbNatureOfGoods);
  }

  private async assertCustomerWarehouseForConsignment(customerId: string, warehouseId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, isActive: true },
    });
    if (!customer?.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, isActive: true, type: true, customerId: true },
    });
    if (!warehouse?.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }

    if (warehouse.type === WarehouseType.DEDICATED) {
      if (warehouse.customerId && warehouse.customerId !== customerId) {
        throw new BadRequestException('Warehouse is dedicated to a different customer');
      }
    } else {
      const mapped = await this.prisma.$queryRaw<Array<{ customerId: string }>>`
        SELECT wc.customer_id AS "customerId"
        FROM warehouse_customers wc
        WHERE wc.warehouse_id = ${warehouseId}
          AND wc.is_active = true
      `;
      if (mapped.length === 0) return;
      const ok = mapped.some((m) => m.customerId === customerId);
      if (!ok) {
        throw new BadRequestException('Customer is not mapped to this shared warehouse');
      }
    }
  }

  private async validateAsnLinks(
    db: PrismaService | Prisma.TransactionClient,
    customerId: string,
    warehouseId: string,
    asnIds: string[],
    excludeConsignmentId: string | undefined,
  ) {
    const unique = [...new Set(asnIds)];
    if (unique.length !== asnIds.length) {
      throw new BadRequestException('Duplicate inbound ASN ids');
    }

    for (const asnId of unique) {
      const existingLink = await db.importConsignmentAsn.findUnique({
        where: { inboundAsnId: asnId },
        select: { importConsignmentId: true },
      });
      if (existingLink && existingLink.importConsignmentId !== excludeConsignmentId) {
        throw new ConflictException(`ASN is already linked to another import consignment`);
      }

      const asn = await db.inboundAsn.findUnique({
        where: { id: asnId },
        select: { id: true, customerId: true, warehouseId: true },
      });
      if (!asn) {
        throw new NotFoundException(`Inbound ASN not found: ${asnId}`);
      }
      if (asn.customerId !== customerId || asn.warehouseId !== warehouseId) {
        throw new BadRequestException('ASN customer or warehouse does not match consignment');
      }
    }
  }
}
