import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ContactPicInputDto } from './contact-pic-input.dto';

export class CreateOperatorCompanyDto {
  @ApiProperty({ example: 'OPR-A' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'PT Operator Gudang A' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '021-5550123' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Jl. Industri No. 1' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @ApiPropertyOptional({ example: 'JAWA BARAT' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @ApiPropertyOptional({ example: 'KOTA BANDUNG' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'BANDUNG WETAN' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional({ example: 'CIHAPIT' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subdistrict?: string;

  @ApiPropertyOptional({ example: '40114' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ type: [ContactPicInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactPicInputDto)
  pics?: ContactPicInputDto[];
}
