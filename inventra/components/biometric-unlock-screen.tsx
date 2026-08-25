import { ThemedView } from '@/components/themed-view';
import { getPalette } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function BiometricUnlockScreen() {
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { user, unlockWithBiometrics, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function probeer() {
    setError(null);
    const gelukt = await unlockWithBiometrics();
    if (!gelukt) {
      setError('Ontgrendelen is niet gelukt, probeer het opnieuw.');
    }
  }

  useEffect(() => {
    probeer();
  }, []);

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <View style={styles.content}>
        <View style={[styles.icoonCirkel, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="finger-print-outline" size={40} color={p.accent} />
        </View>

        <Text style={[styles.titel, { color: p.text }]}>Inventra is vergrendeld</Text>
        <Text style={[styles.subtitel, { color: p.textSecondary }]}>
          {user ? `Welkom terug, ${user.naam}` : 'Ontgrendel om verder te gaan'}
        </Text>

        {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

        <TouchableOpacity style={[styles.knop, { backgroundColor: '#534AB7' }]} onPress={probeer}>
          <Text style={styles.knopTekst}>Ontgrendel met Face ID / vingerafdruk</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uitloggenLink} onPress={logout}>
          <Text style={[styles.uitloggenTekst, { color: p.textSecondary }]}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 4 },
  icoonCirkel: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  titel: { fontSize: 20, fontWeight: '700', fontFamily: 'Montserrat', textAlign: 'center' },
  subtitel: { fontSize: 14, fontFamily: 'Montserrat', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  error: { fontSize: 12, fontFamily: 'Montserrat', textAlign: 'center', marginBottom: 12 },
  knop: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center' },
  knopTekst: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  uitloggenLink: { marginTop: 20, padding: 8 },
  uitloggenTekst: { fontSize: 13, fontFamily: 'Montserrat' },
});
