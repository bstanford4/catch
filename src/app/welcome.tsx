import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/components/ui/button';
import { colors, radius, spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={[colors.cream, '#E2EEE3']} style={styles.screen}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>CATCH</Text>
        <Text style={styles.tagline}>Find your people. Go play.</Text>
      </View>

      <View style={styles.art}>
        <View style={styles.ringOuter}>
          <View style={styles.ringInner}>
            <Text style={styles.ball}>⚾</Text>
          </View>
        </View>
        <View style={styles.floatOne}><Text style={styles.floatEmoji}>🏈</Text></View>
        <View style={styles.floatTwo}><Text style={styles.floatEmoji}>🥏</Text></View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>CASUAL PLAY. REAL PEOPLE.</Text>
        <Text style={styles.title}>Somebody nearby wants to have a catch too.</Text>
        <Text style={styles.body}>
          Pick an activity, say when you’re free, and turn a spare hour into a good one.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button icon="mail" label="Continue with email" onPress={() => router.push('/sign-in')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)')}
          style={styles.demo}>
          <Ionicons color={colors.forest} name="sparkles" size={17} />
          <Text style={styles.demoText}>Explore the seeded demo</Text>
        </Pressable>
        <Text style={styles.legal}>
          Catch is for adults 18+. By continuing, you agree to play responsibly and meet safely.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 62,
    paddingBottom: 34,
  },
  brand: {
    alignItems: 'center',
  },
  wordmark: {
    color: colors.forest,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tagline: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  art: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 174,
    height: 174,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 87,
    backgroundColor: colors.forest,
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 6,
  },
  ringInner: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 63,
    backgroundColor: colors.paper,
  },
  ball: {
    fontSize: 71,
  },
  floatOne: {
    position: 'absolute',
    left: '10%',
    top: 18,
    width: 55,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.paleOrange,
    transform: [{ rotate: '-9deg' }],
  },
  floatTwo: {
    position: 'absolute',
    right: '8%',
    bottom: 13,
    width: 55,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#E2EDF2',
    transform: [{ rotate: '8deg' }],
  },
  floatEmoji: {
    fontSize: 28,
  },
  copy: {
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    maxWidth: 430,
    marginTop: 8,
    color: colors.ink,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1.1,
  },
  body: {
    maxWidth: 390,
    marginTop: 11,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  demo: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  demoText: {
    color: colors.forest,
    fontSize: 14,
    fontWeight: '800',
  },
  legal: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
