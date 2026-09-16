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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>D</Text>
            </View>
            <Text style={styles.brandName}>DeliverEats Driver</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.kicker}>APP REPARTIDOR</Text>
            <Text style={styles.title}>Muévete con{`\n`}propósito.</Text>
            <Text style={styles.subtitle}>
              Recibe ofertas cercanas, completa los recojos y comparte tu GPS solo durante la
              entrega.
            </Text>
            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Field
                    label="Correo"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                    error={errors.password?.message}
                  />
                )}
              />
              {errors.root?.message ? (
                <Text style={styles.error}>{errors.root.message}</Text>
              ) : null}
              <Button label="Ingresar" onPress={submit} loading={isSubmitting} tone="amber" />
            </View>
          </View>
          <Link href="/register" style={styles.footer}>Quiero ser repartidor</Link>
          <Link href="/forgot-password" style={styles.footer}>Recuperar contraseña</Link>
          <Link href="/legal" style={styles.footer}>Términos y privacidad</Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingVertical: 36 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 27 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.navy, fontSize: 24, fontWeight: '900' },
  brandName: { color: colors.white, fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: colors.white, borderRadius: 26, padding: 24 },
  kicker: { color: '#C87800', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: {
    color: colors.navy,
    fontSize: 35,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 10,
  },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  form: { gap: 17, marginTop: 26 },
  error: {
    color: colors.red,
    backgroundColor: '#FEF2F2',
    borderRadius: 11,
    padding: 11,
    fontSize: 11,
    fontWeight: '700',
  },
  footer: { color: '#CBD5E1', textAlign: 'center', fontSize: 13, marginTop: 21 },
});
