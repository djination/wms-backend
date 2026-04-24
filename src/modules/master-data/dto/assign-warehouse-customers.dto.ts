import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignWarehouseCustomersDto {
  @ApiProperty({ example: '7ef0b6cf-8443-4ad9-a66f-48b6597152f4' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({
    example: ['23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f'],
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  customerIds!: string[];
}
