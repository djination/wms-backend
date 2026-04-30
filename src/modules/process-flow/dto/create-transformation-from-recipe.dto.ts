import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class RecipeInputBinDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  binId!: string;

  @ApiPropertyOptional({ example: 'LOT-RAW-001' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiPropertyOptional({ example: 'BATCH-RAW-001' })
  @IsOptional()
  @IsString()
  batchNo?: string;

  @ApiPropertyOptional({ type: [String], example: ['SN-RAW-001', 'SN-RAW-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNos?: string[];
}

export class CreateTransformationFromRecipeDto {
  @ApiProperty()
  @IsString()
  processNo!: string;

  @ApiProperty()
  @IsUUID()
  recipeId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty()
  @IsUUID()
  outputBinId!: string;

  @ApiPropertyOptional({ example: 'LOT-OUT-001' })
  @IsOptional()
  @IsString()
  outputLotNo?: string;

  @ApiPropertyOptional({ example: 'BATCH-OUT-001' })
  @IsOptional()
  @IsString()
  outputBatchNo?: string;

  @ApiPropertyOptional({ type: [String], example: ['SN-OUT-001', 'SN-OUT-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outputSerialNos?: string[];

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyOutput!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outputUomId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [RecipeInputBinDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeInputBinDto)
  inputBins!: RecipeInputBinDto[];
}
