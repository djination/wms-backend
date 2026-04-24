import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { SupplierPicInputDto } from './supplier-pic-input.dto';

export class CreateSupplierDto {
  @ApiProperty({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: 'SUP-001' })
  @IsString()
  @MaxLength(80)
  code!: string;

  @ApiProperty({ example: 'PT Supplier Nusantara' })
  @IsString()
  @MaxLength(120)
  name!: string;

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

  @ApiPropertyOptional({ type: [SupplierPicInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPicInputDto)
  pics?: SupplierPicInputDto[];
}
