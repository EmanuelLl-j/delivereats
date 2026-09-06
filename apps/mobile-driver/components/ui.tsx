import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
export const colors = {
  navy: '#071A2F',
  navy2: '#0C2747',
  amber: '#F5A20B',
  canvas: '#F5F7FA',
  green: '#22A06B',
  muted: '#64748B',
  line: '#E4E9EF',
  white: '#FFFFFF',
  red: '#DC2626',
};
export function Button({
  label,
  onPress,
  loading,
  tone = 'navy',
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  tone?: 'navy' | 'amber' | 'red' | 'ghost';
  disabled?: boolean;
}) {
  const background =
    tone === 'amber'
      ? colors.amber
      : tone === 'red'
        ? '#FEE2E2'
        : tone === 'ghost'
          ? '#EAF0F6'
          : colors.navy2;
  const color = tone === 'navy' ? colors.white : tone === 'red' ? colors.red : colors.navy;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && { opacity: 0.8 },
        (disabled || loading) && { opacity: 0.55 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.buttonText, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        style={[styles.input, error && { borderColor: colors.red }]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
export function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 14, fontWeight: '900' },
  label: { color: '#334155', fontSize: 12, fontWeight: '800' },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFC',
    paddingHorizontal: 15,
    color: colors.navy,
  },
  error: { color: colors.red, fontSize: 11, fontWeight: '700' },
  eyebrow: { color: '#C87800', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: {
    color: colors.navy,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 7,
  },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
});
