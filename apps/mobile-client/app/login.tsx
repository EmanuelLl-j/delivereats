import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Button, colors, Field } from '@/components/ui';
import { login } from '@/lib/api';

const schema = z.object({
  email: z.email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
type Values = z.infer<typeof schema>;

export default function LoginScreen() {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const submit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      router.replace('/(tabs)/home');
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'No se pudo iniciar sesión',
      });
    }
  });
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>D</Text>
            </View>
            <Text style={styles.brandName}>DeliverEats</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>CLIENTE AYACUCHO</Text>
            <Text style={styles.title}>Tu ciudad, a un toque.</Text>
            <Text style={styles.subtitle}>
              Ingresa y combina productos de tus comercios favoritos.
            </Text>
            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Field
                    label="Correo electrónico"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    error={errors.email?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Field
                    label="Contraseña"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    autoComplete="current-password"
                    error={errors.password?.message}
                  />
                )}
              />
              {errors.root?.message ? (
                <Text style={styles.error}>{errors.root.message}</Text>
              ) : null}
              <Button label="Ingresar" onPress={submit} loading={isSubmitting} variant="amber" />
            </View>
            <View style={styles.links}>
              <Link href="/forgot-password" style={styles.link}>
                ¿Olvidaste tu contraseña?
              </Link>
              <Link href="/register" style={styles.link}>
                Crear cuenta
              </Link>
            </View>
          </View>
          <Link href="/legal" style={styles.footer}>Términos y privacidad</Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingVertical: 36 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.navy, fontSize: 25, fontWeight: '900' },
  brandName: { color: colors.white, fontSize: 21, fontWeight: '900' },
  card: { backgroundColor: colors.white, borderRadius: 26, padding: 24 },
  eyebrow: { color: '#C87800', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: {
    color: colors.navy,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.3,
    marginTop: 10,
  },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  form: { gap: 17, marginTop: 28 },
  error: {
    padding: 12,
    borderRadius: 12,
    color: colors.red,
    backgroundColor: '#FEF2F2',
    fontSize: 12,
    fontWeight: '700',
  },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  link: { color: colors.navy2, fontSize: 12, fontWeight: '800' },
  footer: { color: '#94A3B8', fontSize: 11, textAlign: 'center', marginTop: 22 },
});
