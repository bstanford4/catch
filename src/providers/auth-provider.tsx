import type { Session, User } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { isDemoMode, supabase } from '@/lib/supabase';
import { revokeStoredPushToken } from '@/services/notification-service';

type AuthResult = {
  error?: string;
  needsEmailConfirmation?: boolean;
};

export type UserProfile = {
  activitySlugs: string[];
  age21Affirmed: boolean;
  areaLabel: string;
  athleticRatingVisible: boolean;
  firstName: string;
  preferredRadiusMiles: number;
  userId: string;
};

export type ProfileInput = {
  activitySlugs: string[];
  age21Affirmed: boolean;
  areaLabel: string;
  firstName: string;
  preferredRadiusMiles: number;
};

type ProfileState = {
  profile: UserProfile | null;
  userId: string;
};

type AuthContextValue = {
  completeProfile: (input: ProfileInput) => Promise<AuthResult>;
  isDemoMode: boolean;
  isLoading: boolean;
  isProfileLoading: boolean;
  profile: UserProfile | null;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(
  row: {
  age_21_affirmed_at: string | null;
  area_label: string;
  athletic_rating_visible: boolean;
  first_name: string;
  preferred_radius_miles: number;
  user_id: string;
  },
  activitySlugs: string[] = [],
): UserProfile {
  return {
    activitySlugs,
    age21Affirmed: Boolean(row.age_21_affirmed_at),
    areaLabel: row.area_label,
    athleticRatingVisible: row.athletic_rating_visible,
    firstName: row.first_name,
    preferredRadiusMiles: row.preferred_radius_miles,
    userId: row.user_id,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const currentUserId = session?.user.id ?? null;
  const profile = profileState?.userId === currentUserId ? profileState.profile : null;
  const isProfileLoading = Boolean(currentUserId) && profileState?.userId !== currentUserId;

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (!error) setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !currentUserId) return;

    let active = true;
    const userId = currentUserId;

    async function loadProfile() {
      if (!supabase) return;
      const { data: profileRow } = await supabase
        .from('profiles')
        .select(
          'user_id, first_name, area_label, preferred_radius_miles, age_21_affirmed_at, athletic_rating_visible',
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (!active) return;
      if (!profileRow) {
        setProfileState({ userId, profile: null });
        return;
      }

      const { data: preferenceRows } = await supabase
        .from('user_activity_preferences')
        .select('activity_type_id')
        .eq('user_id', userId);
      const activityIds = preferenceRows?.map((row) => row.activity_type_id) ?? [];
      const { data: activityRows } = activityIds.length
        ? await supabase.from('activity_types').select('slug').in('id', activityIds)
        : { data: [] };

      if (!active) return;
      setProfileState({
        userId,
        profile: mapProfile(
          profileRow,
          activityRows?.map((row) => row.slug) ?? [],
        ),
      });
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [currentUserId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isDemoMode,
      isLoading,
      isProfileLoading,
      profile,
      session,
      user: session?.user ?? null,
      completeProfile: async (input) => {
        if (!supabase || !session) return { error: 'Sign in before creating a profile.' };

        const { data: activityRows, error: activityError } = await supabase
          .from('activity_types')
          .select('id, slug')
          .in('slug', input.activitySlugs);

        if (activityError) return { error: activityError.message };
        if (!activityRows || activityRows.length !== input.activitySlugs.length) {
          return { error: 'One or more activities could not be found. Please try again.' };
        }

        const now = new Date().toISOString();
        const profileRow = {
          user_id: session.user.id,
          first_name: input.firstName.trim(),
          area_label: input.areaLabel.trim(),
          age_18_affirmed_at: now,
          age_21_affirmed_at: input.age21Affirmed ? now : null,
          preferred_radius_miles: input.preferredRadiusMiles,
        };

        const { error: profileError } = await supabase.from('profiles').upsert(profileRow);
        if (profileError) return { error: profileError.message };

        const activityPreferences = activityRows.map((activity) => ({
          user_id: session.user.id,
          activity_type_id: activity.id,
        }));
        const { error: preferencesError } = await supabase
          .from('user_activity_preferences')
          .upsert(activityPreferences);
        if (preferencesError) return { error: preferencesError.message };

        const { error: notificationsError } = await supabase
          .from('notification_preferences')
          .upsert({ user_id: session.user.id });
        if (notificationsError) return { error: notificationsError.message };

        setProfileState({
          userId: session.user.id,
          profile: {
            activitySlugs: input.activitySlugs,
            age21Affirmed: input.age21Affirmed,
            areaLabel: input.areaLabel.trim(),
            athleticRatingVisible: false,
            firstName: input.firstName.trim(),
            preferredRadiusMiles: input.preferredRadiusMiles,
            userId: session.user.id,
          },
        });
        return {};
      },
      signIn: async (email, password) => {
        if (!supabase) return { error: 'Supabase is not configured. Use the seeded demo instead.' };
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (data.session) setSession(data.session);
        return error ? { error: error.message } : {};
      },
      signOut: async () => {
        if (!supabase) return {};
        if (session) await revokeStoredPushToken(session.user.id);
        const { error } = await supabase.auth.signOut();
        if (!error) setSession(null);
        return error ? { error: error.message } : {};
      },
      signUp: async (email, password) => {
        if (!supabase) return { error: 'Supabase is not configured. Use the seeded demo instead.' };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              age_18_affirmed: true,
            },
          },
        });
        if (error) return { error: error.message };
        if (data.session) setSession(data.session);
        return { needsEmailConfirmation: !data.session };
      },
    }),
    [isLoading, isProfileLoading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
