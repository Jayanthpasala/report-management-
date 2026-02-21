import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../utils/theme';

function DashboardIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="grid" size={size} color={color} />;
}
function UploadIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="camera" size={size + 4} color={color} />;
}
function VaultIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="folder-open" size={size} color={color} />;
}
function ReviewIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="checkmark-circle" size={size} color={color} />;
}
function ProfileIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="person" size={size} color={color} />;
}

export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role || 'staff';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background.surface,
          borderTopColor: colors.border.default,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: role === 'staff' ? 'Home' : 'Dashboard',
          tabBarIcon: DashboardIcon,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: UploadIcon,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Vault',
          tabBarIcon: VaultIcon,
          href: role === 'staff' ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ReviewIcon,
          href: (role === 'owner' || role === 'accounts') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ProfileIcon,
        }}
      />
    </Tabs>
  );
}
