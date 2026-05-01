import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SignOutButton } from '@/components/auth/singout';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { useModeToggle } from '@/hooks/useModeToggle';
import { api } from '@/supabase/api';

export default function ProfileScreen() {
  const text = useColor('text');
  const { mode, toggleMode } = useModeToggle();

  // TanStack Query gives us loading/error/refetch semantics on top of
  // our api function, without coupling this screen to Supabase.
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.loggedInUser,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Spinner color={text} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
          Not Authenticated
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: text,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        }}
      >
        YOUR SUPABASE User ID
      </Text>
      <Text
        style={{ fontSize: 13, color: text, fontWeight: '500' }}
        numberOfLines={1}
        ellipsizeMode='middle'
      >
        {user.id}
      </Text>

      <SignOutButton />

      <Button onPress={() => toggleMode()}>
        <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>
          {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}
        </Text>
      </Button>
    </View>
  );
}
