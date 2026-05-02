// supabase/api/auth.ts

import { supabase } from '@/supabase/client';
import { ApiError, getUserIdOrNull } from './_helpers';
import type { Database } from '@/supabase/types';

export type User = Database['public']['Tables']['users']['Row'];

/** Client-side password rules. RLS doesn't enforce these, the server does. */
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

  /**
   * Guest / anonymous sign-in. Creates a real auth.users row with
   * `is_anonymous = true`. The handle_new_user trigger (migration 0004)
   * creates the matching public.users profile automatically.
   *
   * Requires `enable_anonymous_sign_ins = true` in supabase/config.toml,
   * which `npm run dev` syncs to your hosted project.
   */
  async signInAnonymously() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /**
   * Promote the currently-signed-in anonymous user to a permanent
   * email-based account. The same auth.uid stays the same — all of
   * their existing rows (posts, settings, whatever) keep working.
   *
   * Requires the user to verify the email (Supabase sends a confirm
   * link by default), then call `setPasswordForUpgradedUser` once
   * they've confirmed.
   */
  async upgradeAnonymousToEmail(email: string) {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /** Set a password on an upgraded (formerly anonymous) account. */
  async setPasswordForUpgradedUser(password: string) {
    validatePasswordRequirements(password);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /** Sign out and clear the session from SecureStore. */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ApiError(error.message, error.code, error);
  },

  /**
   * `loggedInUser` query — returns the full public.users row for the
   * current session, or null when not authenticated. Returns null
   * (instead of throwing) so screens can render an unauth state.
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

  /** True if the current session is an anonymous user. */
  async isAnonymous(): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    // The `is_anonymous` flag lives on the JWT app_metadata.
    return data.user?.is_anonymous ?? false;
  },
};
