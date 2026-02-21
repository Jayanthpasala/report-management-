import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="calendar" options={{ presentation: 'modal', headerShown: true, headerStyle: { backgroundColor: '#18181b' }, headerTintColor: '#f8fafc', title: 'Calendar Compliance' }} />
        <Stack.Screen name="document-detail" options={{ presentation: 'modal', headerShown: true, headerStyle: { backgroundColor: '#18181b' }, headerTintColor: '#f8fafc', title: 'Document Detail' }} />
      </Stack>
    </AuthProvider>
  );
}
