import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const LOGIN_PLATFORM_VALUES = ['web', 'mobile'] as const;
export type LoginPlatform = (typeof LOGIN_PLATFORM_VALUES)[number];

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: LOGIN_PLATFORM_VALUES, default: 'web' })
  @IsOptional()
  @IsString()
  @IsIn(LOGIN_PLATFORM_VALUES)
  platform?: LoginPlatform;

  @ApiPropertyOptional({
    example: 'demo',
    description: 'Optional if X-Tenant-Slug header or TENANT_DEFAULT_SLUG is set',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
