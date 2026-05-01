import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeToggleProvider, useModeToggle } from '@/hooks/useModeToggle';
import { ThemeProvider } from '@/theme/theme-provider';
import { View } from 'react-native';
import { useColor } from '@/hooks/useColor';
import { Spinner } from '@/components/ui/spinner';
import { Authentication } from '@/components/auth/authentication';
import 'react-native-reanimated';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// TanStack Query is our reactivity layer
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeToggleProvider>
              <ThemeProvider>
                <RootNavigator />
                <StatusBarHandler />
              </ThemeProvider>
            </ThemeToggleProvider>
          </QueryClientProvider>
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const StatusBarHandler = () => {
  const { isDark } = useModeToggle();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
};

const RootNavigator = () => {
  const text = useColor('text');
  const background = useColor('background');

  const { status } = useAuth();

  return (
    <>
      {status === 'loading' ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: background,
          }}
        >
          <Spinner color={text} />
        </View>
      ) : status === 'unauthenticated' ? (
        <Authentication />
      ) : (
        <NativeTabs
          minimizeBehavior='onScrollDown'
          labelVisibilityMode='labeled'
        >
          <NativeTabs.Trigger name='index' disableTransparentOnScrollEdge>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'house', selected: 'house.fill' }}
              md='home'
            />
            <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name='profile' disableTransparentOnScrollEdge>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'person', selected: 'person.fill' }}
              md='person'
            />
            <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          {/* <NativeTabs.Trigger
            name='search'
            role='search'
            disableTransparentOnScrollEdge
          >
            <NativeTabs.Trigger.Icon sf='magnifyingglass' md='search' />
            <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger> */}
        </NativeTabs>
      )}
    </>
  );
};
