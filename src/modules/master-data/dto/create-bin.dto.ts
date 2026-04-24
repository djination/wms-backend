import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBinDto {
  @ApiProperty({ example: '7ef0b6cf-8443-4ad9-a66f-48b6597152f4' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ example: 'cb6f56f5-42f4-4f57-8c65-18ddf44fd489' })
  @IsUUID()
  zoneId!: string;

  @ApiProperty({ example: 'BIN-A1-001' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Bin A1-001' })
  @IsString()
  @MaxLength(120)
  name!: string;
}
