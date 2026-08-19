import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RetryProvisionDto {
  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminName?: string;
}
