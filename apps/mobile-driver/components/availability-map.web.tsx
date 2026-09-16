import { Text, View } from 'react-native';
export function AvailabilityMap({ point }: { point?: { latitude: number; longitude: number } }) {
  return <View style={{ height: 180, borderRadius: 20, backgroundColor: '#1e194b', padding: 24, justifyContent: 'center', gap: 12 }}><Text style={{ color: 'white', fontWeight: '800', fontSize: 20 }}>Zona de operación · Ayacucho</Text><Text style={{ color: '#cbd5e1' }}>{point ? 'Tu GPS: ' + point.latitude.toFixed(5) + ', ' + point.longitude.toFixed(5) : 'Todavía no hay una señal GPS del dispositivo.'}</Text><Text style={{ color: '#cbd5e1' }}>El mapa interactivo está disponible en la aplicación nativa.</Text></View>;
}

