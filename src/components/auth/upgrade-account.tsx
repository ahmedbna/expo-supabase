// components/auth/upgrade-account.tsx
//
// If the current user is anonymous, render a "save your account"
// prompt that converts them to a permanent email-based user without
// losing their data (same auth.uid).
//
// This component is optional — drop it into a screen where you'd
// normally show the user's profile.

import { useState } from 'react';
import { Text, TextInput, View, Platform, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { api } from '@/supabase/api';

export function UpgradeAccount() {
  const queryClient = useQueryClient();
  const text = useColor('text');
  const border = useColor('border');
  const errorColor = useColor('red');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'done'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Show this UI only if the current user is anonymous.
  const { data: isAnon } = useQuery({
    queryKey: ['auth', 'isAnonymous'],
    queryFn: api.auth.isAnonymous,
  });
  if (!isAnon) return null;

  const submitEmail = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.auth.upgradeAnonymousToEmail(email);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Verify your email',
        `We sent a confirmation link to ${email}. Tap the link, then come back to set a password.`,
      );
      setStep('password');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not link email.');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.auth.setPasswordForUpgradedUser(password);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      setStep('done');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not set password. Did you confirm your email?');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: `${border}33`,
        }}
      >
        <Text style={{ color: text, fontWeight: '700' }}>
          Account upgraded — you can sign in with email + password now.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        padding: 16,
        gap: 12,
        borderRadius: 12,
        backgroundColor: `${border}22`,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
        Save your guest account
      </Text>
      <Text style={{ color: `${text}99`, fontSize: 13 }}>
        Adding an email keeps your data if you sign out or switch devices.
        You won't lose anything you've already created.
      </Text>

      {step === 'email' && (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder='you@example.com'
            placeholderTextColor={`${text}66`}
            keyboardType='email-address'
            autoCapitalize='none'
            style={{
              borderWidth: 1,
              borderColor: border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: text,
            }}
          />
          {!!err && <Text style={{ color: errorColor, fontSize: 12 }}>{err}</Text>}
          <Button
            onPress={submitEmail}
            disabled={busy || !email}
            style={{
              backgroundColor: text,
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '700' }}>
              {busy ? '···' : 'Send verification email'}
            </Text>
          </Button>
        </>
      )}

      {step === 'password' && (
        <>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder='Set a password (8+, A-z, 0-9)'
            placeholderTextColor={`${text}66`}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: text,
            }}
          />
          {!!err && <Text style={{ color: errorColor, fontSize: 12 }}>{err}</Text>}
          <Button
            onPress={submitPassword}
            disabled={busy || !password}
            style={{
              backgroundColor: text,
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '700' }}>
              {busy ? '···' : 'Set password'}
            </Text>
          </Button>
        </>
      )}
    </View>
  );
}
