import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

class UpdateAsnItemDto {
  @ApiProperty({ example: 'eb16cdfc-8630-4c1b-9134-c47eeeb3f32f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: '6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd' })
  @IsString()
  @MaxLength(120)
  supplierId!: string;

  @ApiProperty({ example: '3a4f3120-ff3f-4c63-9df6-37830c4e4c4d' })
  @IsUUID()
  uomId!: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  qtyExpected!: number;
}

export class UpdateAsnItemsDto {
  @ApiProperty({ type: [UpdateAsnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateAsnItemDto)
  items!: UpdateAsnItemDto[];
}
