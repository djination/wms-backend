import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class MaterialTransformationInputDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  binId!: string;

  @ApiProperty({ example: 3.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyConsumed!: number;
}

export class CreateMaterialTransformationDto {
  @ApiProperty()
  @IsString()
  processNo!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty()
  @IsUUID()
  outputProductId!: string;

  @ApiProperty()
  @IsUUID()
  outputBinId!: string;

  @ApiProperty({ example: 1.25 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyOutput!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [MaterialTransformationInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialTransformationInputDto)
  inputs!: MaterialTransformationInputDto[];
}
