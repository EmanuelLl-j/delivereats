import { describe, expect, it } from 'vitest';
import { UserRole } from '@delivereats/shared-types';
import { RolesGuard } from './index';

function context(role: UserRole) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'user', role } }) }),
  };
}

describe('RBAC guard', () => {
  it('allows a declared role', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => [UserRole.ADMIN] } as never);
    expect(guard.canActivate(context(UserRole.ADMIN) as never)).toBe(true);
  });

  it('denies cross-role access', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => [UserRole.ADMIN] } as never);
    expect(() => guard.canActivate(context(UserRole.MERCHANT) as never)).toThrow(
      'No tienes permisos para esta operación',
    );
  });
});
