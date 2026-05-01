// supabase/api/auth.ts

import { supabase } from '@/supabase/client';
import { ApiError, getUserIdOrNull } from './_helpers';
import type { Database } from '@/supabase/types';

export type User = Database['public']['Tables']['users']['Row'];

/** Client-visible password rules */
function validatePasswordRequirements(password: string): void {
  if (!password || password.length < 8) {
    throw new ApiError('Password must be at least 8 characters long');
  }
  if (!/\d/.test(password)) {
    throw new ApiError('Password must contain at least one number');
  }
  if (!/[a-z]/.test(password)) {
    throw new ApiError('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    throw new ApiError('Password must contain at least one uppercase letter');
  }
}

export const auth = {
  /** Email + password sign-in. Throws ApiError on failure. */
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /** Email + password sign-up. Client-side password check runs first. */
  async signUp(email: string, password: string) {
    validatePasswordRequirements(password);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /** Guest / anonymous sign-in. Creates a real auth.users row. */
  async signInAnonymously() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /** Sign out and clear the session from SecureStore. */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /**
   * `loggedInUser` query — returns the full public.users row for the current session, or null when not
   * authenticated. Returns null (instead of throwing)
   */
  async loggedInUser(): Promise<User | null> {
    const userId = await getUserIdOrNull();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new ApiError(error.message, error.code, error);
    return data;
  },
};
