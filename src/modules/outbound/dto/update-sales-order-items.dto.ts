import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsUUID, ValidateNested } from 'class-validator';

class UpdateSalesOrderItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  qtyOrdered!: number;
}

export class UpdateSalesOrderItemsDto {
  @ApiProperty({ type: [UpdateSalesOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateSalesOrderItemDto)
  items!: UpdateSalesOrderItemDto[];
}
