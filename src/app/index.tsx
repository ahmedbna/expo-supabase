import { Text, View } from 'react-native';
import { useColor } from '@/hooks/useColor';

export default function HomeScreen() {
  const text = useColor('text');

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 32,
          fontWeight: '800',
          color: text,
          letterSpacing: -0.5,
        }}
      >
        Home
      </Text>
    </View>
  );
}
