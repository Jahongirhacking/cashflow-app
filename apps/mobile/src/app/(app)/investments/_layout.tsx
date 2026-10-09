import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function InvestmentsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[type]" />
    </Stack>
  );
}
