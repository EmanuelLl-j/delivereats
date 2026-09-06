import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Field, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { saveSession, type Session } from '@/lib/session';

export default function RegisterScreen() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      const session = await api<Session>('/users/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await saveSession(session);
      Alert.alert('Cuenta creada', 'Ya puedes explorar DeliverEats.');
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert(
        'No se pudo registrar',
        error instanceof Error ? error.message : 'Inténtalo nuevamente',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            eyebrow="Nueva cuenta"
            title="Empieza a pedir"
            subtitle="Tus datos se protegen y nunca compartimos tu contraseña."
          />
          <Field
            label="Nombres"
            value={form.firstName}
            onChangeText={(value) => setForm({ ...form, firstName: value })}
          />
          <Field
            label="Apellidos"
            value={form.lastName}
            onChangeText={(value) => setForm({ ...form, lastName: value })}
          />
          <Field
            label="Correo"
            value={form.email}
            onChangeText={(value) => setForm({ ...form, email: value })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Celular"
            value={form.phone}
            onChangeText={(value) => setForm({ ...form, phone: value })}
            keyboardType="phone-pad"
            placeholder="+51987654321"
          />
          <Field
            label="Contraseña"
            value={form.password}
            onChangeText={(value) => setForm({ ...form, password: value })}
            secureTextEntry
          />
          <Text style={styles.help}>Mínimo 8 caracteres, mayúscula, número y símbolo.</Text>
          <Button label="Crear mi cuenta" onPress={submit} loading={loading} variant="amber" />
          <Button label="Volver" onPress={() => router.back()} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 22, gap: 15 },
  help: { color: colors.muted, fontSize: 11, marginTop: -7 },
});
