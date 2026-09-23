import MapView, { Marker } from 'react-native-maps';
import Constants from 'expo-constants';
import { Text, View } from 'react-native';
export function AvailabilityMap({ point }: { point?: { latitude: number; longitude: number } }) {
  if (!Constants.expoConfig?.extra?.mapsConfigured) return <View style={{ height: 150, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: '#475569', textAlign: 'center', fontWeight: '700' }}>Mapa no configurado en esta compilación</Text><Text style={{ color: '#64748b', textAlign: 'center', marginTop: 6 }}>La jornada puede probarse sin abrir el componente nativo de Google Maps.</Text></View>;
  return <View style={{ height: 290, borderRadius: 20, overflow: 'hidden' }}><MapView style={{ flex: 1 }} region={{ latitude: point?.latitude ?? -13.1631, longitude: point?.longitude ?? -74.2236, latitudeDelta: 0.045, longitudeDelta: 0.045 }}>{point && <Marker coordinate={point} title="Tu última posición GPS" />}</MapView></View>;
}
