import { useState } from 'react';
import { Text, TextInput, View, Platform } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
} from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { useAuth } from '@/hooks/useAuth';

type AuthStep = 'signIn' | 'signUp';

// ─── Input ───────────────────────────────────────────────────────────
type InputProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  hasError: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  autoCorrect?: boolean;
  autoComplete?: string;
  editable?: boolean;
};

const Input = ({
  label,
  value,
  onChangeText,
  hasError,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  autoComplete,
  editable = true,
}: InputProps) => {
  const [focused, setFocused] = useState(false);
  const floatAnim = useSharedValue(value ? 1 : 0);

  const text = useColor('text');
  const border = useColor('border');
  const error = useColor('red');

  const handleFocus = () => {
    setFocused(true);
    floatAnim.value = withTiming(1, { duration: 180 });
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };

  const handleBlur = () => {
    setFocused(false);
    if (!value) floatAnim.value = withTiming(0, { duration: 180 });
  };

  const labelStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 22,
    top: interpolate(floatAnim.value, [0, 1], [18, 6]),
    fontSize: interpolate(floatAnim.value, [0, 1], [16, 11]),
    fontWeight: '500',
    color: hasError ? error : focused ? text : `${text}99`,
  }));

  const borderColor = hasError ? error : focused ? text : border;

  return (
    <View
      style={{
        position: 'relative',
        borderRadius: 100,
        borderColor,
        borderWidth: focused || hasError ? 2 : 1.5,
        backgroundColor: `${border}22`,
        height: 58,
        paddingHorizontal: 22,
        justifyContent: 'flex-end',
      }}
    >
      <Animated.Text style={labelStyle}>{label}</Animated.Text>
      <TextInput
        style={{
          fontSize: 16,
          color: text,
          paddingBottom: 6,
          paddingTop: 18,
        }}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete as any}
        editable={editable}
        placeholderTextColor='transparent'
        placeholder=' '
      />
    </View>
  );
};

export const Authentication = () => {
  const { signIn, signUp, signInAnonymously } = useAuth();

  const [step, setStep] = useState<AuthStep>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setError] = useState('');

  const slideAnim = useSharedValue(0);

  const background = useColor('background');
  const text = useColor('text');
  const border = useColor('border');
  const error = useColor('red');

  const resetFormState = () => {
    setEmail('');
    setPassword('');
    setError('');
    setLoading(false);
  };

  const changeStep = (newStep: AuthStep) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    slideAnim.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(0, { duration: 200 }),
    );
    resetFormState();
    setStep(newStep);
  };

  const validateEmail = (v: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError('Please enter a valid email address.');
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    setError('');
    return true;
  };

  const validatePassword = (v: string) => {
    if (v.length < 8 || !/\d/.test(v) || !/[a-z]/.test(v) || !/[A-Z]/.test(v)) {
      setError('Password must be 8+ chars with uppercase, lowercase & number.');
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail(email) || !validatePassword(password)) return;
    setLoading(true);
    setError('');
    try {
      if (step === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (step === 'signUp') setPassword('');
    } catch (err: any) {
      console.error(`${step} error:`, err);
      setError(
        err?.message ?? 'Authentication failed. Please check your credentials.',
      );
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      await signInAnonymously();
    } catch (err: any) {
      console.error('anonymous sign-in error:', err);
      setError(err?.message ?? 'Could not continue as guest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <KeyboardAwareScrollView
        bottomOffset={80}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 72,
          paddingBottom: 40,
          alignItems: 'center',
          gap: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Image
          style={{ width: 110, height: 110 }}
          source={require('@/assets/images/logo.png')}
          contentFit='contain'
          transition={600}
        />

        {/* Heading */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: text }}>
            {step === 'signIn' ? 'Welcome back' : 'Create account'}
          </Text>
          <Text style={{ fontSize: 15, color: `${text}99` }}>
            {step === 'signIn' ? 'Sign in to continue' : 'Get started for free'}
          </Text>
        </View>

        <View
          style={{
            width: '100%',
            backgroundColor: `${border}22`,
            borderRadius: 24,
            padding: 24,
            gap: 16,
          }}
        >
          {/* Inputs */}
          <View style={{ gap: 14 }}>
            <Input
              label='Email address'
              value={email}
              onChangeText={setEmail}
              hasError={!!errorMsg}
              keyboardType='email-address'
              autoCapitalize='none'
              autoCorrect={false}
              autoComplete='email'
              editable={!loading}
            />
            <Input
              label='Password'
              value={password}
              onChangeText={setPassword}
              hasError={!!errorMsg}
              secureTextEntry
              autoComplete={
                step === 'signIn' ? 'current-password' : 'new-password'
              }
              editable={!loading}
            />
          </View>

          {/* Error */}
          {!!errorMsg && (
            <View
              style={{
                backgroundColor: `${error}22`,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              <Text
                style={{
                  color: error,
                  fontSize: 13,
                  fontWeight: '500',
                  textAlign: 'center',
                }}
              >
                {errorMsg}
              </Text>
            </View>
          )}

          <Button
            onPress={handleSubmit}
            disabled={loading}
            hapticStyle='medium'
            style={{
              backgroundColor: text,
              borderRadius: 100,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text
              style={{ color: background, fontSize: 16, fontWeight: '800' }}
            >
              {loading
                ? '···'
                : step === 'signIn'
                  ? 'Sign In'
                  : 'Create Account'}
            </Text>
          </Button>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: border }} />
            <Text
              style={{ fontSize: 12, color: `${text}88`, fontWeight: '600' }}
            >
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: border }} />
          </View>

          {/* Guest */}
          <Button
            onPress={handleGuest}
            hapticStyle='light'
            style={{
              borderRadius: 100,
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: border,
            }}
            disabled={loading}
          >
            <Text style={{ color: text, fontSize: 16, fontWeight: '800' }}>
              {loading ? '...' : 'Continue as Guest'}
            </Text>
          </Button>
        </View>

        {/* Step toggle */}
        <Button
          onPress={() => changeStep(step === 'signIn' ? 'signUp' : 'signIn')}
          style={{ paddingVertical: 8 }}
          hapticStyle='selection'
          disabled={loading}
        >
          <Text
            style={{
              fontSize: 14,
              color: `${text}99`,
              textAlign: 'center',
            }}
          >
            {step === 'signIn'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <Text
              style={{
                fontWeight: '700',
                color: text,
                textDecorationLine: 'underline',
              }}
            >
              {step === 'signIn' ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>
        </Button>
      </KeyboardAwareScrollView>

      <KeyboardToolbar
        content={<Text style={{ color: text }}>Fill in the fields above</Text>}
        showArrows={true}
        doneText='Done'
      />
    </View>
  );
};
