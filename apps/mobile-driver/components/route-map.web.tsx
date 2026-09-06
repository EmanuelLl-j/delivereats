import { MapPin, Route } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { RoutePoint } from './route-map';
import { colors } from './ui';

export function RouteMap({
  points,
}: {
  points: RoutePoint[];
  destination: { latitude: number; longitude: number };
}) {
  return (
    <View style={styles.map}>
      <View style={styles.icon}>
        <Route size={30} color={colors.amber} />
      </View>
      <Text style={styles.title}>Ruta coordinada en Ayacucho</Text>
      <Text style={styles.copy}>
        <MapPin size={13} color={colors.amber} /> {points.length} recojo(s) y un destino final
      </Text>
      <Text style={styles.note}>
        El mapa interactivo está disponible en las apps iOS y Android.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy2,
    padding: 24,
  },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#173E65',
  },
  title: { marginTop: 13, color: colors.white, fontSize: 14, fontWeight: '900' },
  copy: { marginTop: 7, color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
  note: { marginTop: 15, color: '#94A3B8', fontSize: 9 },
});
