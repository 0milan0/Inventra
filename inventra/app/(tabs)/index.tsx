import { StyleSheet, ScrollView, TouchableOpacity, View, Text, Animated } from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { DrawerMenu } from '@/components/drawer-menu';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const omzetTrend = [
  { month: 'jan', value: 5 },
  { month: 'feb', value: 4 },
  { month: 'mrt', value: 3.5 },
  { month: 'apr', value: 4.5 },
  { month: 'mei', value: 4 },
  { month: 'jun', value: 5 },
  { month: 'jul', value: 6 },
  { month: 'aug', value: 6 },
];

const quickActions: {
  title: string;
  subtitle: string;
  progress: number;
  href: '/(tabs)' | '/(tabs)/explore' | '/modal';
}[] = [
    { title: 'THT', subtitle: 'Tenminste Houdbaar Tot', progress: 92, href: '/(tabs)' },
    { title: 'Gestuurde', subtitle: 'Bekijk extra informatie', progress: 68, href: '/(tabs)/explore' },
    { title: 'Modal', subtitle: 'Open het modal scherm',  progress: 24, href: '/modal' },
  ];

export default function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const chartHtml = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; background: transparent; }
      .wrap { width: 100%; height: 170px; }
      canvas { width: 100% !important; height: 100% !important; }
    </style>
  </head>
  <body>
    <div class="wrap"><canvas id="trend"></canvas></div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const ctx = document.getElementById('trend');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ${JSON.stringify(omzetTrend.map((d) => d.month))},
          datasets: [{
            data: ${JSON.stringify(omzetTrend.map((d) => d.value))},
            borderColor: '${colors.tint}',
            backgroundColor: '${colors.tint}',
            borderWidth: 3,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '${colors.tint}'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              displayColors: false,
              backgroundColor: '${colors.background}',
              borderColor: '${colors.border}',
              borderWidth: 1,
              titleColor: '${colors.text}',
              bodyColor: '${colors.tint}',
              titleFont: { weight: '700' },
              callbacks: {
                label: (ctx) => ctx.parsed.y + 'k omzet'
              }
            }
          },
          interaction: {
            mode: 'nearest',
            intersect: false
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '${colors.textSecondary}' },
              border: { display: false }
            },
            y: {
              min: 0,
              max: 7,
              ticks: { color: '${colors.textSecondary}', stepSize: 1 },
              grid: { color: '${colors.border}' },
              border: { display: false }
            }
          }
        }
      });
    </script>
  </body>
</html>`;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.hamburgerBtn}
            accessibilityLabel="Open menu"
          >
            <View style={[styles.bar, { backgroundColor: colors.text }]} />
            <View style={[styles.bar, { backgroundColor: colors.text }]} />
            <View style={[styles.bar, { backgroundColor: colors.text }]} />
          </TouchableOpacity>

          <ThemedText style={styles.headerTitle}>Dashboard</ThemedText>

          <View style={[styles.avatar, { backgroundColor: colors.tint + '22' }]}>
            <Text style={[styles.avatarText, { color: colors.tint }]}>JD</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={styles.welcomeRow}>
          <ThemedText style={styles.welcomeText}>Welkom terug,</ThemedText>
          <Text style={[styles.usergreet, { color: colors.tint }]}>Milan</Text>
        </View>
        {/* Lijn diagram */}
        <View style={[styles.progressSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.progressTitle}>Omzet trend</ThemedText>
          <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>Omzet (x 1000)</Text>

          <View style={[styles.chartWebviewContainer, { borderColor: colors.border }]}> 
            <WebView
              originWhitelist={['*']}
              source={{ html: chartHtml }}
              javaScriptEnabled
              scrollEnabled={false}
              style={styles.chartWebview}
            />
          </View>
        </View>

        {/* Quick actions */}
        <ThemedText style={styles.sectionTitle}>Snelle acties</ThemedText>
        <View style={styles.actionsRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(action.href)}
              activeOpacity={0.8}
            >
              <View style={styles.actionMain}>
                <View style={styles.actionTopRow}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>{action.title}</Text>
                </View>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>{action.subtitle}</Text>
              </View>

              <View style={styles.actionBottom}>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.tint, width: `${action.progress}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {action.progress}% voltooid
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Drawer */}
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hamburgerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
  },
  bar: {
    width: 18,
    height: 2,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  welcomeTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  welcomeBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 25,
    fontWeight: '600',
  },
  usergreet: {
    fontSize: 25,
    fontWeight: '700',
  },
  welcomeSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressSection: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 0,
  },
  progressSubtitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  chartWebviewContainer: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  chartWebview: {
    height: 170,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionCard: {
    width: '48.5%',
    minHeight: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  actionMain: {
    gap: 2,
  },
  actionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBottom: {
    marginTop: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 11,
    marginTop: 5,
  },
});