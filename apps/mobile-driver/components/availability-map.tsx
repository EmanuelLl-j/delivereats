import MapView, { Marker } from 'react-native-maps';
import { View } from 'react-native';
export function AvailabilityMap({ point }: { point?: { latitude: number; longitude: number } }) {
  return <View style={{ height: 290, borderRadius: 20, overflow: 'hidden' }}><MapView style={{ flex: 1 }} region={{ latitude: point?.latitude ?? -13.1631, longitude: point?.longitude ?? -74.2236, latitudeDelta: 0.045, longitudeDelta: 0.045 }}>{point && <Marker coordinate={point} title="Tu última posición GPS" />}</MapView></View>;
}

