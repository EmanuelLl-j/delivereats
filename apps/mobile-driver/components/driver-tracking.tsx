import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { getSession, onSessionChanged } from '@/lib/session';
type Point = { latitude: number; longitude: number; speed: number; timestamp: string; orderId?: string };
type Profile = { applicationStatus: string; status: string; assignments: Array<{ orderId: string; status: string }> };
export type GpsState = { point?: Point; pending: number; error?: string; lastSentAt?: string };
export function DriverTracking() {
  const cache = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { let alive = true; void getSession().then(session => { if (alive) setSignedIn(session?.user.role === 'DRIVER'); }); const remove = onSessionChanged(session => setSignedIn(session?.user.role === 'DRIVER')); return () => { alive = false; remove(); }; }, []);
  const profile = useQuery({ queryKey: ['driver-profile'], queryFn: () => api<Profile>('/drivers/drivers/me'), enabled: signedIn, refetchInterval: signedIn ? 5000 : false, retry: false });
  const activeOrder = profile.data?.assignments.find(assignment => assignment.status === 'ACCEPTED')?.orderId;
  const enabled = signedIn && profile.data?.applicationStatus === 'APPROVED' && ['AVAILABLE', 'RESERVED', 'BUSY'].includes(profile.data.status);
  useEffect(() => {
    if (!enabled) { cache.setQueryData(['driver-gps'], { pending: 0 }); return; }
    let alive = true, running = false;
    let buffer: Point[] = [];
    async function sample() {
      if (!alive || running || AppState.currentState !== 'active') return;
      running = true;
      try {
        if (!(await Location.getForegroundPermissionsAsync()).granted) throw new Error('Activa el permiso de ubicación para compartir tu GPS.');
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!alive) return;
        const point: Point = { latitude: current.coords.latitude, longitude: current.coords.longitude, speed: Math.max(0, (current.coords.speed ?? 0) * 3.6), timestamp: new Date(current.timestamp).toISOString(), ...(activeOrder ? { orderId: activeOrder } : {}) };
        buffer = [...buffer.filter(item => Date.now() - new Date(item.timestamp).getTime() < 9 * 60_000), point].slice(-120);
        cache.setQueryData(['driver-gps'], { point, pending: buffer.length } satisfies GpsState);
        try {
          await api('/drivers/drivers/me/locations/batch', { method: 'POST', body: JSON.stringify({ locations: buffer }) });
          buffer = [];
          if (alive) cache.setQueryData(['driver-gps'], { point, pending: 0, lastSentAt: new Date().toISOString() } satisfies GpsState);
        } catch (error) {
          if (error instanceof ApiError && [401, 403].includes(error.status)) buffer = [];
          if (alive) cache.setQueryData(['driver-gps'], { point, pending: buffer.length, error: error instanceof Error ? error.message : 'GPS pendiente de envío' } satisfies GpsState);
        }
      } catch (error) { if (alive) cache.setQueryData(['driver-gps'], { pending: buffer.length, error: error instanceof Error ? error.message : 'No se pudo leer el GPS' } satisfies GpsState); }
      finally { running = false; }
    }
    void sample();
    const timer = setInterval(() => void sample(), 5000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void sample(); });
    return () => { alive = false; clearInterval(timer); foreground.remove(); buffer = []; };
  }, [activeOrder, cache, enabled]);
  return null;
}

