import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, LogOut, MapPin, Settings, ShieldCheck } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { clearSession } from '@/lib/session';

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  customerProfile?: {
    loyaltyPoints: number;
    level: string;
    addresses: Array<{ id: string; label: string; address: string; isDefault: boolean }>;
  };
};

export default function ProfileScreen() {
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api<Profile>('/users/auth/profile'),
  });
  const user = profile.data;
  async function logout() {
    await clearSession();
    router.replace('/login');
  }
  const menu = [
    { Icon: Settings, label: 'Preferencias' },
    { Icon: ShieldCheck, label: 'Seguridad y contraseña' },
  ];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="Tu cuenta"
          title="Perfil"
          subtitle="Preferencias, direcciones y seguridad."
        />
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user ? `${user.firstName[0]}${user.lastName[0]}` : 'AQ'}
            </Text>
          </View>
          <Text style={styles.name}>
            {user ? `${user.firstName} ${user.lastName}` : 'Cargando…'}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.level}>
            <Text style={styles.levelText}>
              {user?.customerProfile?.level ?? 'INICIAL'} ·{' '}
              {user?.customerProfile?.loyaltyPoints ?? 0} puntos
            </Text>
          </View>
        </View>
        <Text style={styles.section}>DIRECCIONES</Text>
        {user?.customerProfile?.addresses.map((address) => (
          <View key={address.id} style={styles.address}>
            <MapPin size={18} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>
                {address.label}
                {address.isDefault ? ' · Principal' : ''}
              </Text>
              <Text style={styles.addressText}>{address.address}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.section}>CONFIGURACIÓN</Text>
        {menu.map(({ Icon, label }) => (
          <Pressable key={label} style={styles.menu}>
            <Icon size={19} color={colors.navy2} />
            <Text style={styles.menuText}>{label}</Text>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>
        ))}
        <Button label="Cerrar sesión" onPress={logout} variant="ghost" />
        <View style={styles.version}>
          <LogOut size={13} color="#94A3B8" />
          <Text style={styles.versionText}>DeliverEats Cliente v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 36 },
  profile: { alignItems: 'center', borderRadius: 22, backgroundColor: colors.navy, padding: 24 },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  name: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 13 },
  email: { color: '#94A3B8', fontSize: 11, marginTop: 5 },
  level: {
    backgroundColor: '#163759',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginTop: 13,
  },
  levelText: { color: colors.amber, fontSize: 9, fontWeight: '900' },
  section: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 25,
    marginBottom: 10,
  },
  address: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 15,
  },
  addressLabel: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  addressText: { color: colors.muted, fontSize: 10, marginTop: 4 },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
    padding: 16,
  },
  menuText: { flex: 1, color: colors.navy, fontSize: 13, fontWeight: '700' },
  version: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 },
  versionText: { color: '#94A3B8', fontSize: 9 },
});
