import { RoleScope } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'ADMIN' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'System Administrator' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: RoleScope, default: RoleScope.OPERATIONAL })
  @IsOptional()
  @IsEnum(RoleScope)
  scope?: RoleScope;
}
