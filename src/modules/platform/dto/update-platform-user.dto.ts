import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PlatformRole } from '../../../generated/platform-prisma';

export class UpdatePlatformUserDto {
  @ApiPropertyOptional({ example: 'Support Agent' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: PlatformRole })
  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
