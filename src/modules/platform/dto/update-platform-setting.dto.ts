import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdatePlatformSettingDto {
  @ApiProperty({ example: { days: 14 } })
  @IsObject()
  value!: Record<string, unknown>;
}
