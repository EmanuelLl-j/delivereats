import type { ReactNode } from 'react';
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
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'amber' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'amber' ? styles.amber : variant === 'ghost' ? styles.ghost : styles.primary,
        pressed && { opacity: 0.82 },
        (disabled || loading) && { opacity: 0.55 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'amber' ? colors.navy : colors.white} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'amber' && { color: colors.navy },
            variant === 'ghost' && { color: colors.navy },
          ]}
        >
          {label}
        </Text>
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
        accessibilityLabel={label}
        placeholderTextColor="#94A3B8"
        style={[styles.input, error && { borderColor: colors.red }]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: string;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 42 }}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.subtitle}>{message}</Text>
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
  primary: { backgroundColor: colors.navy2 },
  amber: { backgroundColor: colors.amber },
  ghost: { backgroundColor: '#EAF0F6' },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  label: { fontSize: 13, color: '#334155', fontWeight: '700' },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 15,
    color: colors.navy,
    backgroundColor: '#FAFBFC',
    fontSize: 15,
  },
  error: { color: colors.red, fontSize: 11, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 24 },
  eyebrow: {
    color: '#C87800',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: { color: colors.navy, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  empty: {
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  emptyTitle: { marginTop: 12, color: colors.navy, fontSize: 17, fontWeight: '800' },
});
