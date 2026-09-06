import { CheckCircle2, MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from './ui';

export type RoutePoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  pickedUp: boolean;
};

export function RouteMap({
  points,
  destination,
}: {
  points: RoutePoint[];
  destination: { latitude: number; longitude: number };
}) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{ ...destination, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
    >
      {points.map((item, index) => (
        <Marker key={item.id} coordinate={item} title={item.name}>
          <View style={[styles.pin, item.pickedUp && { backgroundColor: colors.green }]}>
            {item.pickedUp ? (
              <CheckCircle2 size={17} color={colors.white} />
            ) : (
              <Text style={styles.pinText}>{index + 1}</Text>
            )}
          </View>
        </Marker>
      ))}
      <Marker coordinate={destination} title="Cliente">
        <View style={[styles.pin, { backgroundColor: colors.navy2 }]}>
          <MapPin size={17} color={colors.white} />
        </View>
      </Marker>
      <Polyline coordinates={[...points, destination]} strokeColor={colors.navy2} strokeWidth={4} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 270 },
  pin: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  pinText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
});
