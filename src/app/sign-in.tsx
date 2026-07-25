import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'sign-in' | 'create';

export default function SignInScreen() {
  const router = useRouter();
  const { isDemoMode, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdult, setIsAdult] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isCreateMode = mode === 'create';
  const isValid =
    email.trim().includes('@') &&
    password.length >= 8 &&
    (!isCreateMode || isAdult) &&
    !isSubmitting;

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
  }

  async function submit() {
    if (!isValid) return;
    setIsSubmitting(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    const result = isCreateMode
      ? await signUp(normalizedEmail, password)
      : await signIn(normalizedEmail, password);

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.needsEmailConfirmation) {
      Alert.alert(
        'Check your email',
        'Supabase sent a confirmation link. Open it, then return here and sign in.',
        [{ text: 'Got it', onPress: () => selectMode('sign-in') }],
      );
      return;
    }

    router.replace('/(tabs)');
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>{isCreateMode ? 'JOIN THE CATCH CREW' : 'WELCOME BACK'}</Text>
      <Text style={styles.title}>
        {isCreateMode ? 'Make your spare hour count.' : 'Good to see you again.'}
      </Text>
      <Text style={styles.subtitle}>
        {isCreateMode
          ? 'Create an adults-only Catch account with your email.'
          : 'Sign in to find your catches, messages, and profile.'}
      </Text>

      <View accessibilityRole="tablist" style={styles.modeSwitch}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: isCreateMode }}
          onPress={() => selectMode('create')}
          style={[styles.modeButton, isCreateMode && styles.modeSelected]}>
          <Text style={[styles.modeText, isCreateMode && styles.modeTextSelected]}>
            Create account
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !isCreateMode }}
          onPress={() => selectMode('sign-in')}
          style={[styles.modeButton, !isCreateMode && styles.modeSelected]}>
          <Text style={[styles.modeText, !isCreateMode && styles.modeTextSelected]}>Sign in</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Email</Text>
      <View style={styles.inputWrap}>
        <Ionicons color={colors.muted} name="mail-outline" size={19} />
        <TextInput
          accessibilityLabel="Email address"
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
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoComplete={isCreateMode ? 'new-password' : 'current-password'}
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

      {isCreateMode ? (
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
      ) : null}

      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Ionicons color={colors.error} name="alert-circle" size={18} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.button}>
        <Button
          disabled={!isValid}
          label={
            isSubmitting
              ? 'One moment…'
              : isCreateMode
                ? 'Create my account'
                : 'Sign in'
          }
          onPress={submit}
        />
      </View>

      <View style={styles.securityNote}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={17} />
        <Text style={styles.note}>
          {isDemoMode
            ? 'Backend credentials are not configured; use the seeded demo.'
            : 'Authentication and passwords are handled securely by Supabase.'}
        </Text>
      </View>
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
  modeSwitch: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: '#E9E4DA',
    padding: 4,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  modeSelected: {
    backgroundColor: colors.paper,
  },
  modeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextSelected: {
    color: colors.forest,
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
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#F8E4E0',
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  button: {
    marginTop: spacing.xl,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 11,
  },
  note: {
    color: colors.muted,
    fontSize: 10,
  },
});

