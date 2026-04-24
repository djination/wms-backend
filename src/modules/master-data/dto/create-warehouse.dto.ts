import { WarehouseType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-JKT-01' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Warehouse Jakarta 01' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: WarehouseType, default: WarehouseType.SHARED })
  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @ApiProperty({ example: '0a2f9fce-2a37-4217-b731-2adea988b55f' })
  @IsUUID()
  ownerCompanyId!: string;

  @ApiPropertyOptional({ example: '89f9f7d7-4ee1-49da-a936-9e2dc5c7ba5a' })
  @IsOptional()
  @IsUUID()
  operatorCompanyId?: string;

  @ApiPropertyOptional({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    example: ['23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f', '6d09db63-b89a-4bea-a853-55a5d5b8fd76'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  customerIds?: string[];

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

  @ApiPropertyOptional({ example: 'JAGAKARSA' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional({ example: 'CIPEDAK' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subdistrict?: string;

  @ApiPropertyOptional({ example: '12630' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;
}
