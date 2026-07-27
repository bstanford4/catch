import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { CatchMateRow } from '@/components/catch-mate-row';
import { HostedCatchCard } from '@/components/hosted-catch-card';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { activities, catches, catchMates } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { type HostedCatch, listDiscoverableCatches } from '@/services/catch-service';

export default function DiscoverScreen() {
  const { session } = useAuth();
  const [selected, setSelected] = useState('All');
  const [mode, setMode] = useState<'Catches' | 'People'>('Catches');
  const [query, setQuery] = useState('');
  const [liveCatches, setLiveCatches] = useState<HostedCatch[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await listDiscoverableCatches(session.user.id);
    setLiveCatches(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activityChoices = useMemo(
    () =>
      session
        ? Array.from(
            new Set(liveCatches.map((item) => item.customActivityName ?? item.activity.name)),
          )
        : activities.slice(0, 5).map((item) => item.name),
    [liveCatches, session],
  );
  const filtered = liveCatches.filter((item) => {
    const activity = item.customActivityName ?? item.activity.name;
    const location = item.customVenueName ?? item.venue?.name ?? item.customVenueArea ?? '';
    const matchesActivity = selected === 'All' || activity === selected;
    const haystack = `${item.title} ${activity} ${location}`.toLowerCase();
    return matchesActivity && haystack.includes(query.trim().toLowerCase());
  });

  return (
    <Screen>
      <Text style={styles.eyebrow}>GO PLAY SOMETHING</Text>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Plans and people within 10 miles.</Text>

      <View style={styles.search}>
        <Ionicons color={colors.muted} name="search" size={20} />
        <TextInput
          accessibilityLabel="Search activities or venues"
          onChangeText={setQuery}
          placeholder="Activity, venue, or keyword"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={query}
        />
        <Pressable accessibilityLabel="Open discovery filters" style={styles.filterButton}>
          <Ionicons color={colors.white} name="options" size={19} />
        </Pressable>
      </View>

      <View style={styles.modeSwitch}>
        {(['Catches', 'People'] as const).map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === item }}
            key={item}
            onPress={() => setMode(item)}
            style={[styles.mode, mode === item && styles.modeSelected]}>
            <Text style={[styles.modeText, mode === item && styles.modeTextSelected]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.chips}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {['All', ...activityChoices].map((item) => (
          <Chip
            key={item}
            label={item}
            onPress={() => setSelected(item)}
            selected={selected === item}
          />
        ))}
      </ScrollView>

      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>
          {mode === 'Catches'
            ? `${session ? filtered.length : catches.length} catches nearby`
            : `${catchMates.length} people open`}
        </Text>
        <Pressable accessibilityRole="button" style={styles.mapButton}>
          <Ionicons color={colors.forest} name="map-outline" size={16} />
          <Text style={styles.mapText}>Map</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {mode === 'Catches' && isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.orange} />
            <Text style={styles.loadingText}>Checking nearby Catches...</Text>
          </View>
        ) : null}
        {mode === 'Catches' && error ? <Text style={styles.error}>{error}</Text> : null}
        {mode === 'Catches' && session && !isLoading && !error && filtered.length === 0 ? (
          <StatePanel
            body="Try another activity or check back after someone nearby posts a Catch."
            icon="compass-outline"
            title="Nothing matches yet"
          />
        ) : null}
        {mode === 'Catches' && session
          ? filtered.map((item) => <HostedCatchCard item={item} key={item.id} />)
          : null}
        {mode === 'Catches' && !session
          ? catches.map((item) => <ActivityCard item={item} key={item.id} />)
          : null}
        {mode === 'People'
          ? catchMates.map((mate) => <CatchMateRow key={mate.id} mate={mate} />)
          : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginTop: spacing.sm,
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 14,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 54,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    paddingLeft: 15,
    paddingRight: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
  },
  filterButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.forest,
  },
  modeSwitch: {
    flexDirection: 'row',
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#E9E4DA',
    padding: 4,
  },
  mode: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  modeSelected: {
    backgroundColor: colors.paper,
  },
  modeText: {
    color: colors.muted,
    fontWeight: '700',
  },
  modeTextSelected: {
    color: colors.forest,
  },
  chips: {
    gap: 8,
    paddingVertical: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  resultCount: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 12,
  },
  mapText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
  },
  list: {
    gap: 13,
  },
  loading: { alignItems: 'center', gap: 9, paddingVertical: spacing.xl },
  loadingText: { color: colors.muted, fontSize: 12 },
  error: { color: colors.error, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
