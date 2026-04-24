import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID } from 'class-validator';

export class UpsertInventoryDto {
  @ApiProperty({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: '7ef0b6cf-8443-4ad9-a66f-48b6597152f4' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ example: '9054f0f5-ef77-45cb-b8d3-d4f25841b5da' })
  @IsUUID()
  binId!: string;

  @ApiProperty({ example: 'eb16cdfc-8630-4c1b-9134-c47eeeb3f32f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 120.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  qtyOnHand!: number;
}
