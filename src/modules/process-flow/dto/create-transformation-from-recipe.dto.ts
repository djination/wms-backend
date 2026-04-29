import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class RecipeInputBinDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  binId!: string;
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

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyOutput!: number;

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
