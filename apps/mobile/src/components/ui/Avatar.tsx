import { Image, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name: string;
  uri: string | null;
  size?: number;
}) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={`${name}'s photo`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${name}'s initial`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="bodyStrong" style={{ fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  );
}
