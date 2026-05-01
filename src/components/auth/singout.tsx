import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { Text, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColor } from '@/hooks/useColor';
import { useAuth } from '@/hooks/useAuth';

export const SignOutButton = () => {
  const router = useRouter();
  const { signOut, isAuthenticated } = useAuth();

  const text = useColor('text');
  const red = useColor('red');

  const handleSignOut = async () => {
    if (Platform.OS !== 'web')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await signOut();
      router.dismissAll();
    } catch (error) {
      console.error('Sign out error:', error);
      router.dismissAll();
    }
  };

  if (!isAuthenticated) return null;

  return (
    <TouchableOpacity
      onPress={handleSignOut}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: red,
        borderRadius: 100,
        shadowColor: red,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <LogOut color={text} size={18} strokeWidth={2.5} />
      <Text
        style={{
          color: text,
          fontSize: 16,
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        Sign Out
      </Text>
    </TouchableOpacity>
  );
};
