import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class FeatureFlagCatalogItemDto {
  @ApiProperty({ example: 'transitImport' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'Transit Import' })
  @IsString()
  label!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFeatureFlagCatalogDto {
  @ApiProperty({ type: [FeatureFlagCatalogItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureFlagCatalogItemDto)
  catalog!: FeatureFlagCatalogItemDto[];
}
