import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum DeleteMode {
  SOFT = 'soft',
  HARD = 'hard',
}

export class DeleteMasterDataDto {
  @ApiPropertyOptional({ enum: DeleteMode, default: DeleteMode.SOFT })
  @IsOptional()
  @IsEnum(DeleteMode)
  mode?: DeleteMode;
}
