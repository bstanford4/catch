import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdult, setIsAdult] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Screen>
      <Text style={styles.eyebrow}>EMAIL SIGN-IN</Text>
      <Text style={styles.title}>Welcome to the catch crew.</Text>
      <Text style={styles.subtitle}>
        This Phase 1 screen demonstrates validation and age affirmation. Supabase activates when
        project credentials are configured.
      </Text>

      <Text style={styles.label}>Email</Text>
      <View style={styles.inputWrap}>
        <Ionicons color={colors.muted} name="mail-outline" size={19} />
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
        />
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.inputWrap}>
        <Ionicons color={colors.muted} name="lock-closed-outline" size={19} />
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.muted}
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
        />
        <Pressable
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          hitSlop={10}
          onPress={() => setShowPassword((value) => !value)}>
          <Ionicons color={colors.muted} name={showPassword ? 'eye-off' : 'eye'} size={19} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isAdult }}
        onPress={() => setIsAdult((value) => !value)}
        style={styles.checkRow}>
        <View style={[styles.checkbox, isAdult && styles.checkboxChecked]}>
          {isAdult ? <Ionicons color={colors.white} name="checkmark" size={17} /> : null}
        </View>
        <Text style={styles.checkText}>
          I affirm that I am at least 18 years old. Catch is an adults-only community.
        </Text>
      </Pressable>

      <View style={styles.button}>
        <Button
          disabled={!email.includes('@') || password.length < 8 || !isAdult}
          label="Continue"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
      <Text style={styles.note}>Demo credentials are not transmitted or stored.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginTop: spacing.lg,
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    maxWidth: 390,
    color: colors.ink,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 470,
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: 7,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  inputWrap: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: colors.paper,
  },
  checkboxChecked: {
    borderColor: colors.forest,
    backgroundColor: colors.forest,
  },
  checkText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    marginTop: spacing.xl,
  },
  note: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
  },
});

