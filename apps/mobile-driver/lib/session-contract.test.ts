import { describe, expect, it } from 'vitest';
import { parseSession, resolveStartupRoute, type Session } from './session-contract';
const restored: Session = { accessToken: 'access', refreshToken: 'refresh', user: { id: 'driver-1', role: 'DRIVER', firstName: 'Ana' } };
describe('sesión restaurada al iniciar', () => {
  it('abre DriverHome', async () => expect(await resolveStartupRoute(async () => restored)).toBe('/(tabs)/home'));
  it('descarta sesión incompleta', () => expect(parseSession('{"accessToken":"only"}')).toBeNull());
  it('maneja fallo de SecureStore', async () => expect(await resolveStartupRoute(async () => { throw new Error('secure store'); })).toBe('/login'));
});
