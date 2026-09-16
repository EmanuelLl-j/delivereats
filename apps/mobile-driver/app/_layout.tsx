import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { onSessionChanged } from '../lib/session';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PushLifecycle } from '../components/push-settings';
import { DriverTracking } from '../components/driver-tracking';
export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 8_000, retry: 1 } } }),
  );
  useEffect(() => onSessionChanged(session => { client.clear(); if (!session) router.replace('/login'); }), [client]);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <DriverTracking />
        <PushLifecycle />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F7FA' } }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
