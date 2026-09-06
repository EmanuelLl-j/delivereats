import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bike, LogOut, ShieldCheck } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Header } from '@/components/ui';
import { api } from '@/lib/api';
import { clearSession } from '@/lib/session';
type Profile = {
  documentNumber: string;
  vehicleType: string;
  vehiclePlate?: string;
  licenseNumber?: string;
  rating: string;
  status: string;
};
export default function ProfileScreen() {
  const profile = useQuery({
    queryKey: ['driver-profile'],
    queryFn: () => api<Profile>('/drivers/drivers/me'),
  });
  async function logout() {
    await clearSession();
    router.replace('/login');
  }
  const rows = [
    ['Documento', profile.data?.documentNumber],
    ['Vehículo', profile.data?.vehicleType],
    ['Placa', profile.data?.vehiclePlate ?? 'No aplica'],
    ['Licencia', profile.data?.licenseNumber ?? 'No aplica'],
  ];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header
          eyebrow="CUENTA VERIFICADA"
          title="Perfil"
          subtitle="Información del repartidor y su vehículo."
        />
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Bike size={30} color={colors.navy} />
          </View>
          <Text style={styles.name}>Luis Huamán</Text>
          <View style={styles.verified}>
            <ShieldCheck size={13} color={colors.green} />
            <Text style={styles.verifiedText}>REPARTIDOR APROBADO</Text>
          </View>
          <Text style={styles.rating}>
            ★ {Number(profile.data?.rating ?? 5).toFixed(1)} · {profile.data?.status}
          </Text>
        </View>
        <View style={styles.details}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value ?? '—'}</Text>
            </View>
          ))}
        </View>
        <Button label="Cerrar sesión" onPress={logout} tone="ghost" />
        <View style={styles.version}>
          <LogOut size={13} color="#94A3B8" />
          <Text style={styles.versionText}>DeliverEats Driver v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20 },
  profile: { alignItems: 'center', borderRadius: 23, backgroundColor: colors.navy, padding: 25 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 13 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#163759',
    borderRadius: 9,
    padding: 7,
    marginTop: 10,
  },
  verifiedText: { color: '#A7F3D0', fontSize: 8, fontWeight: '900' },
  rating: { color: '#94A3B8', fontSize: 10, marginTop: 10 },
  details: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 16,
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: { color: colors.muted, fontSize: 11 },
  value: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  version: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 17 },
  versionText: { color: '#94A3B8', fontSize: 9 },
});
