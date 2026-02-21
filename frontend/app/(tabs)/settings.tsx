import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { colors, spacing, radius, fonts } from '../../utils/theme';

export default function SettingsScreen() {
  const { user, organization, outlets, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [notifPrefs, setNotifPrefs] = useState<any>({
    missing_reports: true, anomaly_alerts: true, low_confidence: true, weekly_summary: true, push_enabled: true,
  });
  const [processorInfo, setProcessorInfo] = useState<any>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.getNotificationPrefs().then(setNotifPrefs).catch(() => {});
    api.getProcessorInfo().then(setProcessorInfo).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { owner: 'Organization Owner', manager: 'Outlet Manager', staff: 'Staff Member', accounts: 'Accounts Team' };
    return map[role] || role;
  };

  const roleColor = (role: string) => {
    const map: Record<string, string> = { owner: colors.brand.primary, manager: colors.status.info, staff: colors.status.warning, accounts: colors.brand.secondary };
    return map[role] || colors.text.muted;
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Profile</Text>

        {/* User Card */}
        <View testID="user-profile-card" style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: roleColor(user?.role || '') + '20' }]}>
            <Text style={[s.avatarText, { color: roleColor(user?.role || '') }]}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.name}</Text>
            <Text style={s.profileEmail}>{user?.email}</Text>
            <View style={[s.roleBadge, { backgroundColor: roleColor(user?.role || '') + '15', borderColor: roleColor(user?.role || '') + '40' }]}>
              <Text style={[s.roleText, { color: roleColor(user?.role || '') }]}>{roleLabel(user?.role || '')}</Text>
            </View>
          </View>
        </View>

        {/* Organization */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Organization</Text>
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Ionicons name="business" size={18} color={colors.text.muted} />
              <Text style={s.infoText}>{organization?.name || 'N/A'}</Text>
            </View>
            <View style={s.infoRow}>
              <Ionicons name="globe" size={18} color={colors.text.muted} />
              <Text style={s.infoText}>{organization?.base_currency || 'INR'} Base Currency</Text>
            </View>
          </View>
        </View>

        {/* Outlets */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Outlets ({outlets?.length || 0})</Text>
          {outlets?.map((o: any) => (
            <TouchableOpacity key={o.id} style={s.outletRow} onPress={() => router.push({ pathname: '/calendar', params: { outlet_id: o.id } })}>
              <View style={s.outletIcon}>
                <Ionicons name="storefront-outline" size={20} color={colors.brand.primary} />
              </View>
              <View style={s.outletInfo}>
                <Text style={s.outletName}>{o.name}</Text>
                <Text style={s.outletCity}>{o.city}, {o.country}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats */}
        {stats && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Quick Stats</Text>
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statValue}>{stats.total_documents}</Text>
                <Text style={s.statLabel}>Documents</Text>
              </View>
              <View style={s.statCard}>
                <Text style={[s.statValue, { color: colors.status.warning }]}>{stats.needs_review}</Text>
                <Text style={s.statLabel}>Needs Review</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{stats.suppliers}</Text>
                <Text style={s.statLabel}>Suppliers</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{stats.users}</Text>
                <Text style={s.statLabel}>Users</Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={s.section}>
          {user?.role === 'owner' && (
            <TouchableOpacity testID="manage-users-btn" style={s.menuItem}>
              <Ionicons name="people-outline" size={22} color={colors.text.primary} />
              <Text style={s.menuText}>Manage Users</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="calendar-btn" style={s.menuItem} onPress={() => {
            const oid = user?.outlet_ids?.[0];
            if (oid) router.push({ pathname: '/calendar', params: { outlet_id: oid } });
          }}>
            <Ionicons name="calendar-outline" size={22} color={colors.text.primary} />
            <Text style={s.menuText}>Calendar Compliance</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.status.error} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary, marginBottom: spacing.xxl },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background.surface, borderRadius: radius.xl,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border.default, marginBottom: spacing.xxl,
  },
  avatar: {
    width: 56, height: 56, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg,
  },
  avatarText: { fontSize: fonts.sizes.xxl, fontWeight: fonts.weights.bold },
  profileInfo: { flex: 1 },
  profileName: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  profileEmail: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.sm, borderWidth: 1, marginTop: spacing.sm,
  },
  roleText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },

  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontSize: fonts.sizes.sm, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },

  infoCard: {
    backgroundColor: colors.background.surface, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default, gap: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoText: { fontSize: fonts.sizes.md, color: colors.text.primary },

  outletRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background.surface, borderRadius: radius.md,
    padding: spacing.lg, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border.default,
  },
  outletIcon: {
    width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brand.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  outletInfo: { flex: 1 },
  outletName: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.medium, color: colors.text.primary },
  outletCity: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    width: '47%', backgroundColor: colors.background.surface, borderRadius: radius.md,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default,
  },
  statValue: { fontSize: fonts.sizes.xxl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background.surface, borderRadius: radius.md,
    padding: spacing.lg, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border.default,
  },
  menuText: { flex: 1, fontSize: fonts.sizes.md, color: colors.text.primary, marginLeft: spacing.md },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.status.error + '10', borderRadius: radius.md,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.status.error + '30',
  },
  logoutText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.status.error },
});
