import { supabase } from '@/lib/supabase';

export type AttendanceValue = 'attended' | 'no_show';
export type ResolvedAttendance = AttendanceValue | 'pending' | 'disputed' | 'ineligible';

export type CatchAttendanceMember = {
  catchId: string;
  catchTitle: string;
  isSelf: boolean;
  myConfirmation: AttendanceValue | null;
  resolvedStatus: ResolvedAttendance;
  startsAt: string;
  subjectId: string;
  subjectName: string;
};

export type MyAttendanceStatus = {
  attendanceRequired: boolean;
  catchId: string;
  resolvedStatus: ResolvedAttendance;
};

type AttendanceRow = {
  catch_id: string;
  catch_title: string;
  is_self: boolean;
  my_confirmation: AttendanceValue | null;
  resolved_status: ResolvedAttendance;
  starts_at: string;
  subject_id: string;
  subject_name: string;
};

export async function listCatchAttendance(catchId: string) {
  if (!supabase) return { data: [] as CatchAttendanceMember[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_catch_attendance', {
    requested_catch_id: catchId,
  });
  if (error) return { data: [] as CatchAttendanceMember[], error: error.message };
  return {
    data: ((data ?? []) as AttendanceRow[]).map((row) => ({
      catchId: row.catch_id,
      catchTitle: row.catch_title,
      isSelf: row.is_self,
      myConfirmation: row.my_confirmation,
      resolvedStatus: row.resolved_status,
      startsAt: row.starts_at,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
    })),
    error: null,
  };
}

export async function saveCatchAttendance(
  catchId: string,
  subjectId: string,
  attendance: AttendanceValue,
) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('upsert_catch_attendance', {
    requested_attendance: attendance,
    requested_catch_id: catchId,
    requested_subject_id: subjectId,
  });
  return { error: error?.message ?? null };
}

export async function listMyAttendanceStatuses() {
  if (!supabase) return { data: [] as MyAttendanceStatus[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_my_attendance_statuses');
  if (error) return { data: [] as MyAttendanceStatus[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      attendance_required: boolean;
      catch_id: string;
      resolved_status: ResolvedAttendance;
    }) => ({
      attendanceRequired: row.attendance_required,
      catchId: row.catch_id,
      resolvedStatus: row.resolved_status,
    })),
    error: null,
  };
}
