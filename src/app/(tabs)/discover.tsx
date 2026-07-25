import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { CatchMateRow } from '@/components/catch-mate-row';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { activities, catches, catchMates } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';

export default function DiscoverScreen() {
  const [selected, setSelected] = useState('All');
  const [mode, setMode] = useState<'Catches' | 'People'>('Catches');

  return (
    <Screen>
      <Text style={styles.eyebrow}>GO PLAY SOMETHING</Text>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Plans and people within 10 miles.</Text>

      <View style={styles.search}>
        <Ionicons color={colors.muted} name="search" size={20} />
        <TextInput
          accessibilityLabel="Search activities or venues"
          placeholder="Activity, venue, or keyword"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
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
        {['All', ...activities.slice(0, 5).map((item) => item.name)].map((item) => (
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
          {mode === 'Catches' ? `${catches.length} catches nearby` : `${catchMates.length} people open`}
        </Text>
        <Pressable accessibilityRole="button" style={styles.mapButton}>
          <Ionicons color={colors.forest} name="map-outline" size={16} />
          <Text style={styles.mapText}>Map</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {mode === 'Catches'
          ? catches.map((item) => <ActivityCard item={item} key={item.id} />)
          : catchMates.map((mate) => <CatchMateRow key={mate.id} mate={mate} />)}
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
});

