import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import useAuthStore from '@/presentation/stores/useAuthStore';

export default function RootLayout() {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exam/[id]" />
        <Stack.Screen name="solve/[testId]" />
        <Stack.Screen name="parent/dashboard" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="help" />
      </Stack>
    </>
  );
}
