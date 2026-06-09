import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportConsignmentDocType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Daftarkan file yang sudah di-upload lewat `POST /upload` ke konsignment ini. */
export class RegisterImportConsignmentDocumentDto {
  @ApiProperty({ enum: ImportConsignmentDocType })
  @IsEnum(ImportConsignmentDocType)
  docType!: ImportConsignmentDocType;

  @ApiProperty({ description: 'Nilai `key` dari respons POST /upload' })
  @IsString()
  @MaxLength(500)
  storageKey!: string;

  @ApiProperty({ example: 'invoice.pdf' })
  @IsString()
  @MaxLength(500)
  originalFileName!: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contentType?: string;
}
