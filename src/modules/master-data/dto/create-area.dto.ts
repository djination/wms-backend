import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({ example: '7ef0b6cf-8443-4ad9-a66f-48b6597152f4' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ example: 'AREA-A' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Area A' })
  @IsString()
  @MaxLength(120)
  name!: string;
}
