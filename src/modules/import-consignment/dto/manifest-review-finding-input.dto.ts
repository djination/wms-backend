import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManifestFindingCategory } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ManifestReviewFindingInputDto {
  @ApiProperty({ enum: ManifestFindingCategory })
  @IsEnum(ManifestFindingCategory)
  category!: ManifestFindingCategory;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
