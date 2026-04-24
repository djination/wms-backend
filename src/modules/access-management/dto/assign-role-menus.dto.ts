import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignRoleMenusDto {
  @ApiProperty({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsUUID()
  roleId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  menuIds!: string[];
}
