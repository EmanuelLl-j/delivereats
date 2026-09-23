import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/components/ui';
import { getSession } from '@/lib/session';
import { resolveStartupRoute } from '@/lib/session-contract';
export default function Index() {
  const [to, setTo] = useState<string>();
  useEffect(() => {
    void resolveStartupRoute(getSession).then(setTo);
  }, []);
  if (to) return <Redirect href={to as never} />;
  return (
    <View style={styles.screen}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>D</Text>
      </View>
      <Text style={styles.name}>DeliverEats Driver</Text>
      <Text style={styles.city}>AYACUCHO</Text>
      <ActivityIndicator color={colors.amber} style={{ marginTop: 30 }} />
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
  name: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 19 },
  city: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 4, marginTop: 7 },
});
