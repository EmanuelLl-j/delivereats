import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, Header } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      const result = await api<{ message: string }>(
        '/users/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) },
      );
      Alert.alert(
        'Solicitud enviada',
        result.message,
      );
      router.push('/reset-password');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Inténtalo nuevamente');
    } finally {
      setLoading(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <Header
        eyebrow="Seguridad"
        title="Recupera tu cuenta"
        subtitle="Te enviaremos instrucciones mediante el proveedor de correo configurado."
      />
      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Button label="Enviar instrucciones" onPress={submit} loading={loading} tone="amber" />
      <Button label="Volver" onPress={() => router.back()} tone="ghost" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, padding: 22, gap: 16 },
});
