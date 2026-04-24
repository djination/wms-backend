import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { SupplierPicInputDto } from './supplier-pic-input.dto';

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'SUP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ example: 'PT Supplier Nusantara (Updated)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '021-5550123' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Jl. Industri No. 1, Jakarta' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @ApiPropertyOptional({ example: 'DKI JAKARTA' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @ApiPropertyOptional({ example: 'KOTA JAKARTA SELATAN' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'KEBAYORAN BARU' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional({ example: 'SENAYAN' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subdistrict?: string;

  @ApiPropertyOptional({ example: '12190' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** When provided, replaces all PIC rows for this supplier (empty array clears them). */
  @ApiPropertyOptional({ type: [SupplierPicInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPicInputDto)
  pics?: SupplierPicInputDto[];
}
