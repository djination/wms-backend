import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class ImpersonateTenantDto {
  @ApiPropertyOptional({
    example: 'admin@acme.com',
    description: 'Tenant admin email; defaults to first active SYSTEM_ADMIN in tenant',
  })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;
}
