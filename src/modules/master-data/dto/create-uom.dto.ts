import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUomDto {
  @ApiProperty({ example: 'PCS' })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Pieces' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Unit per item eceran' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
