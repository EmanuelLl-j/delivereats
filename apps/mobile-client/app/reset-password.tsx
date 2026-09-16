import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, colors } from '../components/ui';
import { api } from '../lib/api';
export default function ResetScreen() {
  const [token, setToken] = useState(''); const [newPassword, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function reset() { setBusy(true); try { await api('/users/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }); setMessage('Contraseña actualizada. Ya puedes iniciar sesión.'); setToken(''); setPassword(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña'); } finally { setBusy(false); } }
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 18 }}><Text style={{ fontSize: 28, color: colors.navy, fontWeight: '900' }}>Nueva contraseña</Text><Text style={{ color: colors.muted }}>Copia el código del correo. Vence en 30 minutos y solo puede utilizarse una vez.</Text><Field label="Código de recuperación" autoCapitalize="none" value={token} onChangeText={setToken} /><Field label="Nueva contraseña" secureTextEntry value={newPassword} onChangeText={setPassword} maxLength={72} /><Text style={{ color: colors.muted }}>Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo.</Text>{!!message && <Text accessibilityRole="alert">{message}</Text>}<Button label="Actualizar contraseña" onPress={reset} loading={busy} /><Button label="Ir al ingreso" onPress={() => router.replace('/login')} /></ScrollView></SafeAreaView>;
}
