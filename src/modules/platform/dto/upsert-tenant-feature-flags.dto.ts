import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

class TenantFeatureFlagItemDto {
  @ApiProperty({ example: 'transitImport' })
  @IsString()
  flagKey!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpsertTenantFeatureFlagsDto {
  @ApiProperty({ type: [TenantFeatureFlagItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantFeatureFlagItemDto)
  flags!: TenantFeatureFlagItemDto[];
}
