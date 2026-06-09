import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManifestReviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ManifestReviewFindingInputDto } from './manifest-review-finding-input.dto';

export class UpdateManifestReviewDto {
  @ApiProperty({ enum: ManifestReviewStatus })
  @IsEnum(ManifestReviewStatus)
  status!: ManifestReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;

  @ApiPropertyOptional({ type: [ManifestReviewFindingInputDto], description: 'Mengganti seluruh daftar temuan' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestReviewFindingInputDto)
  findings?: ManifestReviewFindingInputDto[];

  @ApiPropertyOptional({
    description: 'Wajib jika status WAIVED — alasan pengecualian internal / referensi surat',
  })
  @ValidateIf((o) => o.status === ManifestReviewStatus.WAIVED)
  @IsString()
  @MaxLength(4000)
  waivedReason?: string;
}
