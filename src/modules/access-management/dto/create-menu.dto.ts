import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ example: 'MASTER_DATA' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Master Data' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '/master-data/customers' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string;

  @ApiPropertyOptional({ example: 'database' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: '8f13f740-f338-476f-9ece-78f4f6830ee3' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
