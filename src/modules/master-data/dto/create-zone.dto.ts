import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ example: '7ef0b6cf-8443-4ad9-a66f-48b6597152f4' })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'cb6f56f5-42f4-4f57-8c65-18ddf44fd489' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiProperty({ example: 'ZONE-A1' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Zone A1' })
  @IsString()
  @MaxLength(120)
  name!: string;
}
