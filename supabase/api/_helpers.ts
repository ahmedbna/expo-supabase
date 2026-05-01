// supabase/api/_helpers.ts
//
// Utilities used by every api module. Centralizing these keeps the
// individual modules focused on business logic and ensures consistent
// error handling + auth checks across the app.

import { supabase } from '@/supabase/client';

/**
 * Resolve the current authenticated user's id or throw.
 * RLS enforces this server-side too — this is for clearer client errors.
 */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth error: ${error.message}`);
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/**
 * Get the current user id or null, without throwing. Use this in
 * optional-auth flows.
 */
export async function getUserIdOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Standardized error class for api functions. Makes it easy for the UI
 * to distinguish expected app errors from unexpected crashes.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Unwrap a Supabase { data, error } response, throwing ApiError on
 * failure. Every api function should funnel through this so UI code
 * can rely on try/catch instead of checking result.error manually.
 */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const err = result.error as { message?: string; code?: string };
    throw new ApiError(err.message ?? 'Request failed', err.code, result.error);
  }
  if (result.data === null) {
    throw new ApiError('No data returned');
  }
  return result.data;
}
