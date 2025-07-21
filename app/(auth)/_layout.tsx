// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
// Update the import path if ThemeContext is located elsewhere, for example:
import { useTheme } from '../../contexts/ThemeContext';
// Or create the file at ../../contexts/ThemeContext.tsx if it does not exist.

export default function AuthLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signUp" />
    </Stack>
  );
}