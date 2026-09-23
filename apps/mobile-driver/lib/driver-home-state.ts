export type ApplicationStatus = 'PENDING_REVIEW' | 'REJECTED' | 'SUSPENDED' | 'APPROVED';
export type DriverStatus = 'OFFLINE' | 'AVAILABLE' | 'RESERVED' | 'BUSY' | 'SUSPENDED';
export type Assignment = { id?: string; orderId?: string; estimatedEarnings?: string | number; pickupCount?: number; destination?: string; expiresAt?: string; status?: string };
export type DriverProfile = { status?: string; applicationStatus?: string; reviewReason?: string | null; assignments?: Assignment[]; rating?: string | number | null; vehicle?: unknown; plate?: string | null };

export type DriverHomeState =
  | { screen: 'LOADING' | 'UNAUTHENTICATED' | 'NO_APPLICATION' | 'ERROR'; map: 'hidden' }
  | { screen: 'PENDING_REVIEW' | 'REJECTED' | 'SUSPENDED'; map: 'hidden'; profile: DriverProfile }
  | { screen: 'APPROVED'; map: 'interactive' | 'fallback'; profile: DriverProfile; status: Exclude<DriverStatus, 'SUSPENDED'>; assignments: Assignment[]; active?: Assignment };

const operational = new Set<DriverStatus>(['OFFLINE', 'AVAILABLE', 'RESERVED', 'BUSY']);

export function deriveDriverHomeState(input: { authenticated?: boolean; loading: boolean; error?: boolean; profile?: DriverProfile | null; mapsConfigured: boolean }): DriverHomeState {
  if (input.loading) return { screen: 'LOADING', map: 'hidden' };
  if (!input.authenticated) return { screen: 'UNAUTHENTICATED', map: 'hidden' };
  if (input.error) return { screen: 'ERROR', map: 'hidden' };
  if (!input.profile) return { screen: 'NO_APPLICATION', map: 'hidden' };
  const application = input.profile.applicationStatus;
  if (application === 'PENDING_REVIEW' || application === 'REJECTED') return { screen: application, map: 'hidden', profile: input.profile };
  if (application === 'SUSPENDED' || input.profile.status === 'SUSPENDED') return { screen: 'SUSPENDED', map: 'hidden', profile: input.profile };
  if (application !== 'APPROVED' || !operational.has(input.profile.status as DriverStatus)) return { screen: 'ERROR', map: 'hidden' };
  const assignments = Array.isArray(input.profile.assignments) ? input.profile.assignments : [];
  return { screen: 'APPROVED', map: input.mapsConfigured ? 'interactive' : 'fallback', profile: input.profile, status: input.profile.status as Exclude<DriverStatus, 'SUSPENDED'>, assignments, active: assignments.find(item => item?.status === 'ACCEPTED') };
}

export function finiteMoney(value: unknown): string | null {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number.toFixed(2) : null;
}
