import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'DeliverEats Repartidor',
  slug: 'delivereats-driver',
  scheme: 'delivereats-driver',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'DeliverEats usa tu GPS para asignarte pedidos cercanos.',
        locationAlwaysAndWhenInUsePermission:
          'DeliverEats comparte tu ubicación durante una entrega activa.',
      },
    ],
    'expo-notifications',
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost/api',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost',
  },
  android: { package: 'pe.edu.pdgp.delivereats.driver' },
  ios: { bundleIdentifier: 'pe.edu.pdgp.delivereats.driver' },
};

export default config;
