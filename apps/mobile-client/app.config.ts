import type { ExpoConfig } from 'expo/config';
const production = process.env.APP_VARIANT === 'production' || process.env.EAS_BUILD_PROFILE === 'production';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2/api';
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || apiUrl.replace(/\/api\/?$/, '');
if (production) {
  for (const [name, value] of Object.entries({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL })) {
    if (!value || !value.startsWith('https://') || /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(value)) throw new Error(name + ' debe ser una URL HTTPS real para producción');
  }
  if (!process.env.GOOGLE_MAPS_ANDROID_API_KEY) throw new Error('Falta GOOGLE_MAPS_ANDROID_API_KEY para mapas de producción');
}
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
const config: ExpoConfig = {
  name: 'DeliverEats Cliente',
  slug: 'delivereats-client', scheme: 'delivereats-client', version: '1.0.0',
  orientation: 'portrait', userInterfaceStyle: 'light',
  icon: '../../assets/brand/client-icon.png',
  plugins: [
    'expo-router', 'expo-secure-store', 'expo-dev-client',
    ['expo-splash-screen', { image: '../../assets/brand/client-foreground.png', imageWidth: 280, backgroundColor: '#0B2139' }],
    ['expo-location', { locationWhenInUsePermission: 'DeliverEats utiliza tu ubicación al solicitar o realizar una entrega.' }],
    ['expo-image-picker', { photosPermission: 'Selecciona una imagen o comprobante para esta operación.', cameraPermission: 'Toma una foto como evidencia de esta operación.', microphonePermission: 'Permite el micrófono solo durante una llamada de entrega.' }],
    ['expo-notifications', { color: '#1e194b', defaultChannel: 'deliveries' }],
    ['@livekit/react-native-expo-plugin', { android: { audioType: 'communication', enableScreenShareService: false }, ios: { enableMultitaskingCameraAccess: false } }],
    ['@config-plugins/react-native-webrtc', { microphonePermission: 'Permite el micrófono solo durante una llamada de entrega.', cameraPermission: 'Toma una foto como evidencia de esta operación. Las llamadas usan solo audio.' }],
    ['./plugins/network-policy.cjs', { allowLocalHttp: !production }],
    './plugins/native-build.cjs',
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl, socketUrl, pushConfigured: Boolean(googleServicesFile),
    ...(process.env.EXPO_EAS_PROJECT_ID ? { eas: { projectId: process.env.EXPO_EAS_PROJECT_ID } } : {}),
  },
  android: {
    adaptiveIcon: { foregroundImage: '../../assets/brand/client-foreground.png', backgroundColor: '#0B2139' },
    package: 'pe.edu.pdgp.delivereats.client', versionCode: 1,
    ...(googleServicesFile ? { googleServicesFile } : {}),
    ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } } : {}),
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_MEDIA_VIDEO'],
  },
  ios: {
    bundleIdentifier: 'pe.edu.pdgp.delivereats.client', buildNumber: '1',
    ...(process.env.GOOGLE_MAPS_IOS_API_KEY ? { config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY } } : {}),
    infoPlist: { NSMicrophoneUsageDescription: 'Permite el micrófono solo durante una llamada de entrega.', ITSAppUsesNonExemptEncryption: false },
  },
};
export default config;
