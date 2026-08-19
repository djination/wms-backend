import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PlatformRole } from '../../../generated/platform-prisma';

export class CreatePlatformUserDto {
  @ApiProperty({ example: 'support@wms.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'Support Agent' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: PlatformRole, example: PlatformRole.SUPPORT })
  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;
}
