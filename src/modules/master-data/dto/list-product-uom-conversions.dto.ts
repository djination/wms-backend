import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListProductUomConversionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;
}
