import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { colors, spacing, radius, fonts } from '../utils/theme';

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  anomaly_alert: { icon: 'alert-circle', color: colors.status.error },
  missing_report: { icon: 'document-outline', color: colors.status.warning },
  low_confidence: { icon: 'eye-off-outline', color: colors.status.warning },
  weekly_summary: { icon: 'bar-chart-outline', color: colors.status.info },
  system: { icon: 'settings-outline', color: colors.text.muted },
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const renderNotif = ({ item }: { item: any }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
    return (
      <TouchableOpacity
        testID={`notif-${item.id}`}
        style={[s.card, !item.is_read && s.cardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[s.iconBox, { backgroundColor: config.color + '15' }]}>
          <Ionicons name={config.icon as any} size={22} color={config.color} />
        </View>
        <View style={s.cardContent}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, !item.is_read && s.cardTitleUnread]} numberOfLines={1}>{item.title}</Text>
            <Text style={s.cardTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={s.cardBody} numberOfLines={2}>{item.body}</Text>
          {item.severity === 'critical' && (
            <View style={s.criticalBadge}>
              <Text style={s.criticalText}>CRITICAL</Text>
            </View>
          )}
        </View>
        {!item.is_read && <View style={s.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity testID="notif-back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Notifications</Text>
          {unreadCount > 0 && <Text style={s.subtitle}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity testID="mark-all-read-btn" onPress={markAllRead} style={s.markAllBtn}>
            <Ionicons name="checkmark-done" size={20} color={colors.brand.primary} />
            <Text style={s.markAllText}>Read All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotif}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifs(); }} tintColor={colors.brand.primary} />
          }
          ListEmptyComponent={
            <View style={s.centered}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.text.muted} />
              <Text style={s.emptyText}>No notifications yet</Text>
              <Text style={s.emptySubtext}>Alerts for anomalies, missing reports, and insights will appear here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: fonts.sizes.xs, color: colors.status.error, marginTop: 1 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.brand.primary + '15' },
  markAllText: { fontSize: fonts.sizes.xs, color: colors.brand.primary, fontWeight: fonts.weights.semibold },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border.default },
  cardUnread: { backgroundColor: colors.background.elevated, borderColor: colors.brand.primary + '30' },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.medium, color: colors.text.primary, flex: 1 },
  cardTitleUnread: { fontWeight: fonts.weights.bold },
  cardTime: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginLeft: spacing.sm },
  cardBody: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: 2, lineHeight: 18 },
  criticalBadge: { alignSelf: 'flex-start', backgroundColor: colors.status.error + '20', paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.sm, marginTop: spacing.xs },
  criticalText: { fontSize: 9, fontWeight: '700', color: colors.status.error, letterSpacing: 0.5 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.primary, marginLeft: spacing.sm, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.lg },
  emptySubtext: { fontSize: fonts.sizes.sm, color: colors.text.muted, marginTop: spacing.xs, textAlign: 'center', maxWidth: 280 },
});
