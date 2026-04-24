import { ForbiddenException } from '@nestjs/common';

export type ScopeErrorCode =
  | 'FORBIDDEN_SCOPE_WAREHOUSE'
  | 'FORBIDDEN_SCOPE_OPERATOR'
  | 'FORBIDDEN_SCOPE_CUSTOMER'
  | 'FORBIDDEN_SCOPE_SYSTEM_ADMIN_REQUIRED'
  | 'MISSING_SCOPE_WAREHOUSE'
  | 'MISSING_SCOPE_OPERATOR';

export function throwScopeForbidden(code: ScopeErrorCode, message: string): never {
  throw new ForbiddenException({
    code,
    message,
  });
}
