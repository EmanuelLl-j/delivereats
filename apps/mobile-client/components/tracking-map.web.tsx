import { Bike, MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { TrackingPoint } from './tracking-map';
import { colors } from './ui';

export function TrackingMap({
  pickups,
}: {
  pickups: TrackingPoint[];
  driver?: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  destinationLabel?: string;
}) {
  return (
    <View style={styles.map}>
      <View style={styles.route}>
        <Bike size={27} color={colors.navy} />
        <View style={styles.line} />
        <MapPin size={27} color={colors.white} />
      </View>
      <Text style={styles.title}>Puntos de entrega</Text>
      <Text style={styles.copy}>{pickups.length} recojo(s) antes de tu destino</Text>
      <Text style={styles.note}>Abre iOS o Android para visualizar el mapa interactivo.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 330,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy2,
    padding: 24,
  },
  route: { flexDirection: 'row', alignItems: 'center' },
  line: {
    width: 90,
    height: 3,
    marginHorizontal: 9,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
  title: { marginTop: 15, color: colors.white, fontSize: 15, fontWeight: '900' },
  copy: { marginTop: 7, color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
  note: { marginTop: 15, color: '#94A3B8', fontSize: 9 },
});
