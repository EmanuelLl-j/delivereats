import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { onSessionChanged } from '../lib/session';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PushLifecycle } from '../components/push-settings';

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }),
  );
  useEffect(() => onSessionChanged(session => { queryClient.clear(); if (!session) router.replace('/login'); }), [queryClient]);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PushLifecycle />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F7FA' } }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
