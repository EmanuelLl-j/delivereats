import { Bike, MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from './ui';

export type TrackingPoint = { id: string; name: string; latitude: number; longitude: number };

export function TrackingMap({
  pickups,
  driver,
  destination,
  destinationLabel,
}: {
  pickups: TrackingPoint[];
  driver?: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  destinationLabel?: string;
}) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{ ...destination, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
    >
      <Marker coordinate={destination} title="Destino" description={destinationLabel}>
        <View style={styles.destination}>
          <MapPin size={19} color={colors.white} />
        </View>
      </Marker>
      {pickups.map((point, index) => (
        <Marker key={point.id} coordinate={point} title={`${index + 1}. ${point.name}`}>
          <View style={styles.pickup}>
            <Text style={styles.pickupText}>{index + 1}</Text>
          </View>
        </Marker>
      ))}
      {driver && <Marker coordinate={driver} title="Tu repartidor">
        <View style={styles.driver}>
          <Bike size={19} color={colors.navy} />
        </View>
      </Marker>}
      <Polyline
        coordinates={[...(driver ? [driver] : []), ...pickups, destination]}
        lineDashPattern={[6, 6]}
        strokeColor={colors.navy2}
        strokeWidth={4}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  destination: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.navy2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  pickup: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  pickupText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  driver: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
});
