import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/components/ui';
import { getSession } from '@/lib/session';

export default function Index() {
  const [destination, setDestination] = useState<string>();
  useEffect(() => {
    void getSession().then((session) => setDestination(session ? '/(tabs)/home' : '/login'));
  }, []);
  if (destination) return <Redirect href={destination as never} />;
  return (
    <View style={styles.screen}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>D</Text>
      </View>
      <Text style={styles.name}>DeliverEats</Text>
      <Text style={styles.city}>AYACUCHO</Text>
      <ActivityIndicator color={colors.amber} style={{ marginTop: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.navy, fontSize: 44, fontWeight: '900' },
  name: { marginTop: 20, color: colors.white, fontSize: 29, fontWeight: '900' },
  city: { marginTop: 6, color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 4 },
});
