import { supabase } from '@/lib/supabase';

export type AvailabilityPeriod = 'morning' | 'afternoon' | 'evening';

export type AvailabilityWindow = {
  broadPeriod: AvailabilityPeriod;
  expiresAt: string;
  id: string;
  weekday: number;
};

type AvailabilityRow = {
  broad_period: AvailabilityPeriod;
  expires_at: string;
  id: string;
  weekday: number;
};

export async function listAvailability(userId: string) {
  if (!supabase) {
    return { data: [] as AvailabilityWindow[], error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase
    .from('availability_windows')
    .select('id, weekday, broad_period, expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('weekday')
    .order('broad_period');

  if (error) return { data: [] as AvailabilityWindow[], error: error.message };

  return {
    data: ((data ?? []) as AvailabilityRow[]).map((row) => ({
      broadPeriod: row.broad_period,
      expiresAt: row.expires_at,
      id: row.id,
      weekday: row.weekday,
    })),
    error: null,
  };
}

export async function saveAvailability(
  userId: string,
  weekdays: number[],
  periods: AvailabilityPeriod[],
) {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error: deleteError } = await supabase
    .from('availability_windows')
    .delete()
    .eq('user_id', userId);
  if (deleteError) return { error: deleteError.message };

  if (!weekdays.length || !periods.length) return { error: undefined };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const rows = weekdays.flatMap((weekday) =>
    periods.map((broadPeriod) => ({
      broad_period: broadPeriod,
      expires_at: expiresAt.toISOString(),
      timezone,
      user_id: userId,
      weekday,
    })),
  );

  const { error } = await supabase.from('availability_windows').insert(rows);
  return { error: error?.message };
}
