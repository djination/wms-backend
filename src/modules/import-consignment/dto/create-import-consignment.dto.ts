import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateImportConsignmentDto {
  @ApiPropertyOptional({
    description: 'Nomor unik konsignment; jika kosong digenerate IC-YYYYMMDD-xxx',
    example: 'IC-20260505-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  consignmentNo?: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ example: '157-12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  masterRef?: string;

  @ApiPropertyOptional({ type: [String], description: 'ASN yang dikaitkan ke kiriman ini (customer & warehouse harus sama)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  inboundAsnIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  awbMawb?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  awbHawb?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  awbCarrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  awbFlight?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  awbOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  awbDestination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  awbShipper?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  awbConsignee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  awbPieces?: number;

  @ApiPropertyOptional()
  @IsOptional()
  awbGrossWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  awbChargeableWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  awbNatureOfGoods?: string;
}
