import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SupplierPicInputDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'budi@supplier.com' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;
}
