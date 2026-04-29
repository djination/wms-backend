import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class UpdateProcessRecipeLineDto {
  @ApiPropertyOptional()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyPerBase!: number;
}

export class UpdateProcessRecipeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outputProductId?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  baseOutputQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [UpdateProcessRecipeLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProcessRecipeLineDto)
  lines?: UpdateProcessRecipeLineDto[];
}
