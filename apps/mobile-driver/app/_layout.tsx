import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 8_000, retry: 1 } } }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F7FA' } }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
