import { CustomerType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ContactPicInputDto } from './contact-pic-input.dto';

export class CreateCustomerDto {
  @ApiProperty({ example: 'CUST-ACME' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'ACME Retail Indonesia' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '021-5550123' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1' })
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

  @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.SHARED })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ type: [ContactPicInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactPicInputDto)
  pics?: ContactPicInputDto[];
}
