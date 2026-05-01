// supabase/api/users.ts

import { supabase } from '@/supabase/client';
import { ApiError, requireUserId } from './_helpers';
import type { Database } from '@/supabase/types';

export type User = Database['public']['Tables']['users']['Row'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export const users = {
  /** Mirror of `get` — the current user's full profile. */
  async get(): Promise<User> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw new ApiError(error.message, error.code, error);
    return data;
  },

  /** Mirror of `getbyemail` — look up a profile by email. */
  async getByEmail(email: string): Promise<User | null> {
    await requireUserId();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new ApiError(error.message, error.code, error);
    return data;
  },

  /** Mirror of `getAll` — everyone except the current user, capped at 100. */
  async getAll(): Promise<User[]> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .neq('id', userId)
      .limit(100);
    if (error) throw new ApiError(error.message, error.code, error);
    return data ?? [];
  },

  /** Mirror of `getId` — just the current user's id. */
  async getId(): Promise<string> {
    return requireUserId();
  },

  /**
   * Mirror of `update` — partial update on the current user. Only the
   * fields exposed here can be changed by the client. RLS enforces
   * that the row id matches auth.uid() too.
   */
  async update(patch: {
    name?: string;
    bio?: string;
    gender?: string;
    birthday?: number;
  }): Promise<string> {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId);
    if (error) throw new ApiError(error.message, error.code, error);
    return userId;
  },

  /**
   * Subscribe to realtime changes on the current user's row.
   * Returns an unsubscribe function — always call it in cleanup.
   */
  subscribeToSelf(onChange: (user: User) => void): () => void {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const userId = await requireUserId();
      channel = supabase
        .channel(`user:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`,
          },
          (payload) => onChange(payload.new as User),
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  },
};
