import { ThemedView } from '@/components/themed-view';
import { getPalette } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ActiverenScreen() {
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);
  const { activate } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordHerhaald, setPasswordHerhaald] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const wachtwoordenGelijk = password.length > 0 && password === passwordHerhaald;
  const valid =
    email.trim().length > 0 &&
    code.trim().length > 0 &&
    password.length >= 8 &&
    wachtwoordenGelijk;

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    try {
      await activate(email.trim(), code.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activeren is mislukt.');
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: p.text }]}>Account activeren</Text>
          <Text style={[styles.subtitle, { color: p.textSecondary }]}>
            Vul de code in die je van je beheerder hebt gekregen
          </Text>

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

            <Text style={[styles.label, { color: p.textSecondary }]}>Code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              style={[styles.input, { color: p.text, borderColor: p.border }]}
              placeholder="6-cijferige code"
              placeholderTextColor={p.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Text style={[styles.label, { color: p.textSecondary }]}>Nieuw wachtwoord</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { color: p.text, borderColor: p.border }]}
              placeholder="Minstens 8 tekens"
              placeholderTextColor={p.textSecondary}
              secureTextEntry
            />

            <Text style={[styles.label, { color: p.textSecondary }]}>Herhaal wachtwoord</Text>
            <TextInput
              value={passwordHerhaald}
              onChangeText={setPasswordHerhaald}
              style={[styles.input, { color: p.text, borderColor: p.border }]}
              placeholder="Herhaal je wachtwoord"
              placeholderTextColor={p.textSecondary}
              secureTextEntry
              onSubmitEditing={handleSubmit}
            />
            {passwordHerhaald.length > 0 && !wachtwoordenGelijk && (
              <Text style={[styles.error, { color: p.danger }]}>Wachtwoorden komen niet overeen.</Text>
            )}

            {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: valid && !loading ? '#534AB7' : '#aaa' }]}
              disabled={!valid || loading}
              onPress={handleSubmit}
            >
              <Text style={styles.submitBtnText}>{loading ? 'Bezig...' : 'Account activeren'}</Text>
            </TouchableOpacity>
          </View>

          <Link href="/login" style={styles.terugLink}>
            <Text style={[styles.terugLinkText, { color: p.textSecondary }]}>Terug naar inloggen</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 4 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: 'Montserrat', textAlign: 'center' },
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
