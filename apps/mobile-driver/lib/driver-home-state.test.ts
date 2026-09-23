import { describe, expect, it } from 'vitest';
import { deriveDriverHomeState } from './driver-home-state';
describe('DriverHome', () => {
  it('perfil pendiente', () => expect(deriveDriverHomeState({ authenticated: true, loading: false, profile: { applicationStatus: 'PENDING_REVIEW', status: 'OFFLINE' }, mapsConfigured: true })).toMatchObject({ screen: 'PENDING_REVIEW', map: 'hidden' }));
  it('perfil incompleto', () => expect(deriveDriverHomeState({ authenticated: true, loading: false, profile: {}, mapsConfigured: true })).toEqual({ screen: 'ERROR', map: 'hidden' }));
  it('sin ofertas', () => expect(deriveDriverHomeState({ authenticated: true, loading: false, profile: { applicationStatus: 'APPROVED', status: 'OFFLINE' }, mapsConfigured: false })).toMatchObject({ screen: 'APPROVED', assignments: [], map: 'fallback' }));
  it('Driver aprobado', () => expect(deriveDriverHomeState({ authenticated: true, loading: false, profile: { applicationStatus: 'APPROVED', status: 'BUSY', assignments: [{ id: 'a1', status: 'ACCEPTED' }] }, mapsConfigured: true })).toMatchObject({ screen: 'APPROVED', active: { id: 'a1' } }));
});
