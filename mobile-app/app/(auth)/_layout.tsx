import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Text, View } from 'react-native';

export default function AuthLayout() {
  // Simple layout for auth screens
  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
