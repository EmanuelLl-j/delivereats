import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/api';

export default function RatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [score, setScore] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const rating = useMutation({
    mutationFn: () =>
      api(`/orders/orders/${id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ score, comment: comment || undefined }),
      }),
    onSuccess: () => {
      Alert.alert('¡Gracias!', 'Tu calificación fue registrada.');
      router.replace('/(tabs)/orders');
    },
    onError: (error) => Alert.alert('No se pudo calificar', error.message),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        eyebrow="Pedido entregado"
        title="¿Cómo estuvo todo?"
        subtitle="Tu opinión mejora la experiencia local."
      />
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setScore(value)}>
            <Star
              size={39}
              color={colors.amber}
              fill={value <= score ? colors.amber : 'transparent'}
            />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Cuéntanos sobre la entrega (opcional)"
        placeholderTextColor="#94A3B8"
        multiline
        style={styles.comment}
      />
      <Button
        label="Enviar calificación"
        onPress={() => rating.mutate()}
        loading={rating.isPending}
        variant="amber"
      />
      <Button label="Ahora no" onPress={() => router.back()} variant="ghost" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, padding: 22, gap: 18 },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 24,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  comment: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 15,
    color: colors.navy,
    fontSize: 13,
    textAlignVertical: 'top',
  },
});
