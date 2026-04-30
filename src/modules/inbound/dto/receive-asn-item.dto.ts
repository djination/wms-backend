import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReceiveAsnItemDto {
  @ApiProperty({ example: '8f13f740-f338-476f-9ece-78f4f6830ee3' })
  @IsUUID()
  inboundAsnId!: string;

  @ApiProperty({ example: 'eb16cdfc-8630-4c1b-9134-c47eeeb3f32f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: '6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd' })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ example: '9054f0f5-ef77-45cb-b8d3-d4f25841b5da' })
  @IsUUID()
  binId!: string;

  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  qtyReceived!: number;

  @ApiPropertyOptional({ example: '6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd' })
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional({ example: 'LOT-NTI-20260430-A' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lotNo?: string;

  @ApiPropertyOptional({ example: 'BATCH-20260430-01' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  batchNo?: string;

  @ApiPropertyOptional({ example: '2027-04-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ type: [String], example: ['SN-001', 'SN-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNos?: string[];

  @ApiPropertyOptional({ example: 'Good condition' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
