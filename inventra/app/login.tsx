import { ThemedView } from '@/components/themed-view';
import { getPalette } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LoginScreen() {
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inloggen is mislukt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: p.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: p.text }]}>Inventra</Text>
          <Text style={[styles.subtitle, { color: p.textSecondary }]}>Log in met je account</Text>

          <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={[styles.label, { color: p.textSecondary }]}>E-mailadres</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={[styles.input, { color: p.text, borderColor: p.border }]}
              placeholder="naam@bedrijf.nl"
              placeholderTextColor={p.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, { color: p.textSecondary }]}>Wachtwoord</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { color: p.text, borderColor: p.border }]}
              placeholder="Wachtwoord"
              placeholderTextColor={p.textSecondary}
              secureTextEntry
              onSubmitEditing={handleSubmit}
            />

            {error && (
              <Text style={[styles.error, { color: p.danger }]}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: valid && !loading ? '#534AB7' : '#aaa' }]}
              disabled={!valid || loading}
              onPress={handleSubmit}
            >
              <Text style={styles.submitBtnText}>{loading ? 'Bezig...' : 'Inloggen'}</Text>
            </TouchableOpacity>
          </View>

          <Link href="/activeren" style={styles.terugLink}>
            <Text style={[styles.terugLinkText, { color: p.textSecondary }]}>Account activeren met code</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 4 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: 'Montserrat', textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: 'Montserrat', textAlign: 'center', marginBottom: 24 },
  card: { borderRadius: 12, borderWidth: 0.5, padding: 16, gap: 8 },
  label: { fontSize: 12, fontFamily: 'Montserrat' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontFamily: 'Montserrat' },
  error: { fontSize: 12, fontFamily: 'Montserrat' },
  submitBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Montserrat' },
  terugLink: { alignSelf: 'center', marginTop: 16, padding: 8 },
  terugLinkText: { fontSize: 13, fontFamily: 'Montserrat' },
});
