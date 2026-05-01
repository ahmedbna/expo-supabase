// supabase/client.ts
//
// The ONLY place in the app where `createClient` is called. Everything
// else imports `supabase` from here, and UI code doesn't import this
// directly — it goes through `@/supabase/api`.

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import type { Database } from './types';

// SecureStore has a 2KB size limit on iOS. Supabase tokens are
// well under that, but if you ever hit the limit (e.g., storing
// full user profiles in the session), swap this for AsyncStorage.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copy .env.example to .env.local and fill it in.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN isn't a browser
    flowType: 'pkce',
  },
});

// On native, we need to pause auto-refresh when the app goes to
// background and resume when it returns. Without this, tokens can
// expire mid-session without the SDK noticing.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
