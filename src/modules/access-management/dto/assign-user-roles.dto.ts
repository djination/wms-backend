import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  roleIds!: string[];
}
