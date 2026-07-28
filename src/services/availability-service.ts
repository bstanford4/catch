import { supabase } from '@/lib/supabase';

export type AvailabilityPeriod = 'morning' | 'afternoon' | 'evening';

export type AvailabilityWindow = {
  broadPeriod: AvailabilityPeriod;
  expiresAt: string;
  id: string;
  weekday: number;
};

export type AvailabilitySelection = Pick<AvailabilityWindow, 'broadPeriod' | 'weekday'>;

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
  selections: AvailabilitySelection[],
) {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error: deleteError } = await supabase
    .from('availability_windows')
    .delete()
    .eq('user_id', userId);
  if (deleteError) return { error: deleteError.message };

  if (!selections.length) {
    await supabase.rpc('refresh_open_to_catch_if_active');
    return { error: undefined };
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const rows = selections.map(({ broadPeriod, weekday }) => ({
    broad_period: broadPeriod,
    expires_at: '9999-12-31T23:59:59.999Z',
    timezone,
    user_id: userId,
    weekday,
  }));

  const { error } = await supabase.from('availability_windows').insert(rows);
  if (error) return { error: error.message };

  const { error: refreshError } = await supabase.rpc('refresh_open_to_catch_if_active');
  return { error: refreshError?.message };
}
