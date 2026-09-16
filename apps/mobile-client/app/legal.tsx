import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegalAcceptance } from '../components/legal-acceptance';
import { Button, colors } from '../components/ui';
export default function LegalScreen() {
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><ScrollView contentContainerStyle={{ padding: 22, gap: 20 }}><Text style={{ fontSize: 28, fontWeight: '900', color: colors.navy }}>Términos y privacidad</Text><LegalAcceptance /><Button label="Volver" onPress={() => router.back()} /></ScrollView></SafeAreaView>;
}
