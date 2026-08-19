import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ProvisionTenantDto {
  @ApiProperty({ example: 'acme' })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{2,30}$/, {
    message: 'slug must be 3-31 chars, lowercase letters, numbers, hyphens; start with a letter',
  })
  slug!: string;

  @ApiProperty({ example: 'PT Acme Logistik' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiPropertyOptional({ example: 'Tenant Admin' })
  @IsOptional()
  @IsString()
  adminName?: string;

  @ApiPropertyOptional({ example: 'STARTER' })
  @IsOptional()
  @IsString()
  planCode?: string;
}

export type ProvisionJobPayload = {
  tenantId: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
};
