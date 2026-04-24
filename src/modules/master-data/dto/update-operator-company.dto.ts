import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOperatorCompanyDto } from './create-operator-company.dto';

export class UpdateOperatorCompanyDto extends PartialType(CreateOperatorCompanyDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
