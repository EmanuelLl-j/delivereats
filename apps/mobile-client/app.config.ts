import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'DeliverEats Cliente',
  slug: 'delivereats-client',
  scheme: 'delivereats-client',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'DeliverEats usa tu ubicación para mostrar comercios y seguir tus entregas.',
      },
    ],
    ['expo-notifications', { color: '#F59E0B' }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost/api',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost',
  },
  android: { package: 'pe.edu.pdgp.delivereats.client' },
  ios: { bundleIdentifier: 'pe.edu.pdgp.delivereats.client' },
};

export default config;
