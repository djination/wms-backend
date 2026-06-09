import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class InternalTransferLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  sourceBinId!: string;

  @ApiProperty()
  @IsUUID()
  destinationBinId!: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qty!: number;

  @ApiProperty({ description: 'Input UOM used for this transfer line qty' })
  @IsUUID()
  uomId!: string;
}

export class CreateInternalTransferDto {
  @ApiProperty()
  @IsString()
  transferNo!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty({ description: 'Warehouse where stock is taken from (source bins must belong here)' })
  @IsUUID()
  fromWarehouseId!: string;

  @ApiProperty({
    description:
      'Warehouse where stock is placed. May equal fromWarehouseId for bin-to-bin / zone moves within the same building.',
  })
  @IsUUID()
  toWarehouseId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [InternalTransferLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InternalTransferLineDto)
  lines!: InternalTransferLineDto[];
}
