import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class CreateProcessRecipeLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyPerBase!: number;
}

export class CreateProcessRecipeDto {
  @ApiProperty()
  @IsString()
  recipeCode!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsUUID()
  outputProductId!: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  baseOutputQty!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [CreateProcessRecipeLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcessRecipeLineDto)
  lines!: CreateProcessRecipeLineDto[];
}
