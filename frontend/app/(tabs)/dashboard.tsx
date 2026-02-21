import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Alert, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { colors, spacing, radius, fonts } from '../../utils/theme';

const { width } = Dimensions.get('window');

function fmt(amount: number, short = false): string {
  if (short) {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ---- INSIGHT CARD ----
function InsightCard({ insight, onDismiss }: { insight: any; onDismiss: () => void }) {
  const iconMap: Record<string, string> = {
    critical: 'alert-circle', warning: 'warning', good: 'checkmark-circle', info: 'information-circle',
  };
  return (
    <View testID={`insight-${insight.id}`} style={[s.insightCard, { borderLeftColor: insight.color }]}>
      <View style={s.insightTop}>
        <Ionicons name={(iconMap[insight.severity] || 'information-circle') as any} size={18} color={insight.color} />
        <Text style={[s.insightSeverity, { color: insight.color }]}>{insight.severity?.toUpperCase()}</Text>
        <Text style={s.insightOutlet}>{insight.outlet_name}</Text>
        <TouchableOpacity onPress={onDismiss} style={s.insightDismiss}>
          <Ionicons name="close" size={16} color={colors.text.muted} />
        </TouchableOpacity>
      </View>
      <Text style={s.insightTitle}>{insight.title}</Text>
      <Text style={s.insightDesc}>{insight.description}</Text>
    </View>
  );
}

// ---- EXPORT MODAL ----
function ExportModal({ visible, onClose, token }: { visible: boolean; onClose: () => void; token?: string }) {
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
  const reportTypes = [
    { id: 'pnl', label: 'P&L Statement', icon: 'bar-chart', color: colors.brand.primary },
    { id: 'expense_ledger', label: 'Expense Ledger', icon: 'receipt', color: colors.status.info },
    { id: 'gst_summary', label: 'GST Summary (India)', icon: 'document-text', color: colors.brand.secondary },
    { id: 'multi_currency', label: 'Multi-Currency Report', icon: 'globe', color: colors.status.warning },
  ];

  const handleExport = (type: string, format: string) => {
    const url = api.getExportUrl(type, format);
    Alert.alert('Export Ready', `Report will download as ${format.toUpperCase()}.\n\nIn production, this opens the download link.`);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Export Reports</Text>
            <TouchableOpacity testID="close-export-modal" onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {reportTypes.map(rt => (
            <View key={rt.id} style={s.exportRow}>
              <View style={[s.exportIcon, { backgroundColor: rt.color + '20' }]}>
                <Ionicons name={rt.icon as any} size={22} color={rt.color} />
              </View>
              <Text style={s.exportLabel}>{rt.label}</Text>
              <TouchableOpacity testID={`export-${rt.id}-xlsx`} style={s.exportBtn} onPress={() => handleExport(rt.id, 'xlsx')}>
                <Text style={s.exportBtnText}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`export-${rt.id}-csv`} style={[s.exportBtn, s.exportBtnAlt]} onPress={() => handleExport(rt.id, 'csv')}>
                <Text style={s.exportBtnAltText}>CSV</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ---- OWNER DASHBOARD ----
function OwnerDashboard() {
  const [data, setData] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const [dash, insRes] = await Promise.all([
        api.globalDashboard(30),
        api.getInsights(7).catch(() => ({ insights: [] })),
      ]);
      setData(dash);
      setInsights(insRes.insights || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateInsights = async () => {
    try {
      await api.generateInsights();
      const res = await api.getInsights(7);
      setInsights(res.insights || []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const dismissInsight = async (id: string) => {
    try {
      await api.markInsightRead(id);
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  if (loading) return <LoadingView />;
  if (!data) return <ErrorView onRetry={fetchData} />;

  const criticalInsights = insights.filter(i => i.severity === 'critical');
  const otherInsights = insights.filter(i => i.severity !== 'critical');

  return (
    <ScrollView
      style={s.scrollView}
      contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.brand.primary} />}
    >
      {/* Hero Stats */}
      <View testID="owner-revenue-card" style={s.heroCard}>
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel}>Total Revenue (30d)</Text>
            <Text style={s.heroValue}>{fmt(data.total_revenue)}</Text>
          </View>
          <TouchableOpacity testID="export-btn" style={s.exportTrigger} onPress={() => setShowExport(true)}>
            <Ionicons name="download-outline" size={20} color={colors.brand.primary} />
            <Text style={s.exportTriggerText}>Export</Text>
          </TouchableOpacity>
        </View>
        <View style={s.heroSubRow}>
          <View style={s.heroSubItem}>
            <View style={[s.dot, { backgroundColor: colors.brand.primary }]} />
            <Text style={s.heroSubText}>Profit {fmt(data.total_profit, true)}</Text>
          </View>
          <View style={s.heroSubItem}>
            <View style={[s.dot, { backgroundColor: colors.status.warning }]} />
            <Text style={s.heroSubText}>Food Cost {data.food_cost_pct}%</Text>
          </View>
        </View>
      </View>

      {/* Critical Insights */}
      {criticalInsights.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.status.error }]}>Critical Alerts</Text>
            <Text style={s.alertBadge}>{criticalInsights.length}</Text>
          </View>
          {criticalInsights.slice(0, 3).map(i => (
            <InsightCard key={i.id} insight={i} onDismiss={() => dismissInsight(i.id)} />
          ))}
        </>
      )}

      {/* Quick Actions */}
      <View style={s.quickActions}>
        <TouchableOpacity testID="review-queue-btn" style={s.actionBtn} onPress={() => router.push('/(tabs)/review')}>
          <View style={[s.actionIcon, { backgroundColor: colors.status.error + '20' }]}>
            <Ionicons name="alert-circle" size={22} color={colors.status.error} />
          </View>
          <Text style={s.actionCount}>{data.review_queue_count}</Text>
          <Text style={s.actionLabel}>Review</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="docs-processed-btn" style={s.actionBtn} onPress={() => router.push('/(tabs)/documents')}>
          <View style={[s.actionIcon, { backgroundColor: colors.brand.primary + '20' }]}>
            <Ionicons name="document-text" size={22} color={colors.brand.primary} />
          </View>
          <Text style={s.actionCount}>{data.documents_processed}</Text>
          <Text style={s.actionLabel}>Documents</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="generate-insights-btn" style={s.actionBtn} onPress={generateInsights}>
          <View style={[s.actionIcon, { backgroundColor: colors.brand.secondary + '20' }]}>
            <Ionicons name="sparkles" size={22} color={colors.brand.secondary} />
          </View>
          <Text style={s.actionCount}>AI</Text>
          <Text style={s.actionLabel}>Insights</Text>
        </TouchableOpacity>
      </View>

      {/* Intelligence Feed */}
      {otherInsights.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Intelligence Feed</Text>
          </View>
          {otherInsights.slice(0, 5).map(i => (
            <InsightCard key={i.id} insight={i} onDismiss={() => dismissInsight(i.id)} />
          ))}
        </>
      )}

      {/* Revenue Trend */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Revenue Trend (7d)</Text>
      </View>
      <View style={s.trendCard}>
        {data.daily_trend?.map((d: any, i: number) => {
          const maxRev = Math.max(...data.daily_trend.map((t: any) => t.revenue), 1);
          const barHeight = Math.max(8, (d.revenue / maxRev) * 100);
          return (
            <View key={i} style={s.barCol}>
              <Text style={s.barValue}>{fmt(d.revenue, true)}</Text>
              <View style={[s.bar, { height: barHeight, backgroundColor: i === data.daily_trend.length - 1 ? colors.brand.primary : colors.brand.primary + '60' }]} />
              <Text style={s.barLabel}>{d.date.slice(8)}</Text>
            </View>
          );
        })}
      </View>

      {/* Outlet Performance */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Outlet Performance</Text>
      </View>
      {data.outlet_metrics?.map((outlet: any) => (
        <TouchableOpacity key={outlet.outlet_id} testID={`outlet-card-${outlet.outlet_id}`} style={s.outletCard} activeOpacity={0.7}>
          <View style={s.outletHeader}>
            <Text style={s.outletName} numberOfLines={1}>{outlet.outlet_name}</Text>
            <Text style={s.outletCity}>{outlet.city}</Text>
          </View>
          <View style={s.outletMetrics}>
            <View style={s.metricItem}>
              <Text style={s.metricValue}>{fmt(outlet.revenue, true)}</Text>
              <Text style={s.metricLabel}>Revenue</Text>
            </View>
            <View style={s.metricItem}>
              <Text style={[s.metricValue, outlet.food_cost_pct > 35 ? { color: colors.status.error } : {}]}>
                {outlet.food_cost_pct}%
              </Text>
              <Text style={s.metricLabel}>Food Cost</Text>
            </View>
            <View style={s.metricItem}>
              <Text style={[s.metricValue, { color: outlet.profit > 0 ? colors.brand.primary : colors.status.error }]}>
                {fmt(outlet.profit, true)}
              </Text>
              <Text style={s.metricLabel}>Profit</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Document Types Breakdown */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Document Types</Text>
      </View>
      <View style={s.expenseCard}>
        {Object.entries(data.expense_by_type || {}).map(([type, amount]: [string, any]) => (
          <View key={type} style={s.expenseRow}>
            <View style={s.expenseLeft}>
              <View style={[s.expenseDot, { backgroundColor: typeColor(type) }]} />
              <Text style={s.expenseType}>{type.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={s.expenseAmount}>{fmt(amount, true)}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
      <ExportModal visible={showExport} onClose={() => setShowExport(false)} />
    </ScrollView>
  );
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    purchase_invoice: colors.status.info,
    sales_receipt: colors.brand.primary,
    aggregator_statement: colors.brand.secondary,
    expense_bill: colors.status.warning,
    utility_bill: colors.status.error,
  };
  return map[type] || colors.text.muted;
}

// ---- MANAGER DASHBOARD ----
function ManagerDashboard() {
  const { user, outlets } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const outletId = user?.outlet_ids?.[0] || '';

  const fetchData = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    try { setData(await api.outletDashboard(outletId, 30)); }
    catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [outletId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingView />;
  if (!data) return <ErrorView onRetry={fetchData} />;

  return (
    <ScrollView
      style={s.scrollView} contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.brand.primary} />}
    >
      <Text style={s.outletTitle} numberOfLines={1}>{data.outlet?.name}</Text>
      <View testID="manager-kpi-grid" style={s.kpiGrid}>
        <View style={s.kpiCard}>
          <Ionicons name="trending-up" size={20} color={colors.brand.primary} />
          <Text style={s.kpiValue}>{fmt(data.total_revenue, true)}</Text>
          <Text style={s.kpiLabel}>Revenue</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="restaurant" size={20} color={colors.status.warning} />
          <Text style={[s.kpiValue, data.food_cost_pct > 35 ? { color: colors.status.error } : {}]}>{data.food_cost_pct}%</Text>
          <Text style={s.kpiLabel}>Food Cost</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="cash" size={20} color={colors.brand.primary} />
          <Text style={[s.kpiValue, { color: data.total_profit > 0 ? colors.brand.primary : colors.status.error }]}>{fmt(data.total_profit, true)}</Text>
          <Text style={s.kpiLabel}>Profit</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="receipt" size={20} color={colors.status.info} />
          <Text style={s.kpiValue}>{data.order_count}</Text>
          <Text style={s.kpiLabel}>Orders</Text>
        </View>
      </View>

      <View style={s.splitCard}>
        <Text style={s.splitTitle}>Revenue Split</Text>
        <View style={s.splitRow}>
          <View style={s.splitItem}>
            <View style={[s.splitBar, { flex: data.dine_in_revenue / (data.total_revenue || 1), backgroundColor: colors.brand.primary }]} />
            <Text style={s.splitLabel}>Dine-in {fmt(data.dine_in_revenue, true)}</Text>
          </View>
          <View style={s.splitItem}>
            <View style={[s.splitBar, { flex: data.aggregator_revenue / (data.total_revenue || 1), backgroundColor: colors.brand.secondary }]} />
            <Text style={s.splitLabel}>Aggregator {fmt(data.aggregator_revenue, true)} ({data.aggregator_pct}%)</Text>
          </View>
        </View>
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Daily Performance</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/calendar', params: { outlet_id: outletId } })}>
          <Text style={s.seeAll}>Calendar</Text>
        </TouchableOpacity>
      </View>
      {data.daily_breakdown?.slice(0, 7).map((d: any) => (
        <View key={d.date} style={s.dailyRow}>
          <Text style={s.dailyDate}>{d.date.slice(5)}</Text>
          <Text style={s.dailyRev}>{fmt(d.revenue, true)}</Text>
          <Text style={[s.dailyProfit, { color: d.profit > 0 ? colors.brand.primary : colors.status.error }]}>{fmt(d.profit, true)}</Text>
          <Text style={s.dailyOrders}>{d.orders} ord</Text>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ---- STAFF DASHBOARD ----
function StaffDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  return (
    <View style={s.staffContainer}>
      <View style={s.staffGreeting}>
        <Text style={s.staffHello}>Hello, {user?.name} 👋</Text>
        <Text style={s.staffSubtext}>Tap below to upload a document</Text>
      </View>
      <TouchableOpacity testID="staff-upload-btn" style={s.staffUploadBtn} onPress={() => router.push('/(tabs)/upload')} activeOpacity={0.8}>
        <Ionicons name="camera" size={64} color={colors.text.inverse} />
        <Text style={s.staffUploadText}>Upload Bill</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- MAIN ----
export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (user) {
      api.getNotifications(true).then(r => setNotifCount(r.unread_count || 0)).catch(() => {});
    }
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.centeredView}>
          <Text style={s.emptyText}>Please sign in</Text>
          <TouchableOpacity style={s.signInBtn} onPress={() => router.replace('/')}><Text style={s.signInBtnText}>Go to Login</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>
            {user.role === 'owner' ? 'Global Dashboard' : user.role === 'manager' ? 'Outlet Dashboard' : 'Welcome'}
          </Text>
          <Text style={s.headerSubtitle}>{user.name} · {user.role}</Text>
        </View>
        <TouchableOpacity testID="notification-btn" style={s.notifBtn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          {notifCount > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>{notifCount > 9 ? '9+' : notifCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>
      {user.role === 'owner' ? <OwnerDashboard /> :
       user.role === 'manager' ? <ManagerDashboard /> :
       user.role === 'accounts' ? <OwnerDashboard /> :
       <StaffDashboard />}
    </SafeAreaView>
  );
}

function LoadingView() {
  return <View style={s.centeredView}><ActivityIndicator size="large" color={colors.brand.primary} /><Text style={s.loadingText}>Loading dashboard...</Text></View>;
}
function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.centeredView}>
      <Ionicons name="cloud-offline" size={48} color={colors.text.muted} />
      <Text style={s.emptyText}>Failed to load data</Text>
      <TouchableOpacity style={s.retryBtn} onPress={onRetry}><Text style={s.retryBtnText}>Retry</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  headerTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  headerSubtitle: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  notifBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: colors.status.error, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  heroCard: { backgroundColor: colors.background.surface, borderRadius: radius.xl, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border.default, marginBottom: spacing.lg },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: fonts.sizes.sm, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold, color: colors.text.primary, marginTop: spacing.xs },
  heroSubRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl },
  heroSubItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroSubText: { fontSize: fonts.sizes.sm, color: colors.text.secondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  exportTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand.primary + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  exportTriggerText: { fontSize: fonts.sizes.xs, color: colors.brand.primary, fontWeight: fonts.weights.semibold },

  // Insights
  insightCard: { backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border.default, borderLeftWidth: 4 },
  insightTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  insightSeverity: { fontSize: 10, fontWeight: fonts.weights.bold, letterSpacing: 0.5 },
  insightOutlet: { flex: 1, fontSize: fonts.sizes.xs, color: colors.text.muted, textAlign: 'right' },
  insightDismiss: { marginLeft: spacing.sm },
  insightTitle: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  insightDesc: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: 2, lineHeight: 18 },
  alertBadge: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.bold, color: colors.status.error, backgroundColor: colors.status.error + '20', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },

  // Quick Actions
  quickActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  actionBtn: { flex: 1, backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border.default },
  actionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  actionCount: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  actionLabel: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  seeAll: { fontSize: fonts.sizes.sm, color: colors.brand.primary, fontWeight: fonts.weights.medium },

  trendCard: { flexDirection: 'row', backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border.default, justifyContent: 'space-around', alignItems: 'flex-end', height: 180 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  barValue: { fontSize: 9, color: colors.text.muted, marginBottom: 4 },
  bar: { width: 24, borderRadius: 4, minHeight: 8 },
  barLabel: { fontSize: 10, color: colors.text.muted, marginTop: 4 },

  outletCard: { backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.default },
  outletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  outletName: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary, flex: 1 },
  outletCity: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginLeft: spacing.sm },
  outletMetrics: { flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  metricLabel: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },

  expenseCard: { backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default, marginBottom: spacing.lg },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expenseDot: { width: 10, height: 10, borderRadius: 5 },
  expenseType: { fontSize: fonts.sizes.sm, color: colors.text.secondary, textTransform: 'capitalize' },
  expenseAmount: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary },

  // Manager
  outletTitle: { fontSize: fonts.sizes.xxl, fontWeight: fonts.weights.bold, color: colors.text.primary, marginBottom: spacing.lg },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xxl },
  kpiCard: { width: (width - spacing.xl * 2 - spacing.md) / 2 - 1, backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default },
  kpiValue: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary, marginTop: spacing.sm },
  kpiLabel: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },
  splitCard: { backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default, marginBottom: spacing.xxl },
  splitTitle: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary, marginBottom: spacing.md },
  splitRow: { gap: spacing.md },
  splitItem: { gap: spacing.xs },
  splitBar: { height: 8, borderRadius: 4, minWidth: 20 },
  splitLabel: { fontSize: fonts.sizes.xs, color: colors.text.secondary },
  dailyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  dailyDate: { fontSize: fonts.sizes.sm, color: colors.text.secondary, width: 50 },
  dailyRev: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary, flex: 1 },
  dailyProfit: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, width: 70, textAlign: 'right' },
  dailyOrders: { fontSize: fonts.sizes.xs, color: colors.text.muted, width: 50, textAlign: 'right' },

  // Staff
  staffContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  staffGreeting: { alignItems: 'center', marginBottom: spacing.xxxl },
  staffHello: { fontSize: fonts.sizes.xxl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  staffSubtext: { fontSize: fonts.sizes.md, color: colors.text.secondary, marginTop: spacing.sm },
  staffUploadBtn: { width: 200, height: 200, borderRadius: radius.xl, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  staffUploadText: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.inverse, marginTop: spacing.md },

  // Export Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  modalTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  exportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  exportIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  exportLabel: { flex: 1, fontSize: fonts.sizes.md, color: colors.text.primary },
  exportBtn: { backgroundColor: colors.brand.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, marginLeft: spacing.sm },
  exportBtnText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold, color: colors.text.inverse },
  exportBtnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand.primary },
  exportBtnAltText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold, color: colors.brand.primary },

  // Shared
  centeredView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  loadingText: { fontSize: fonts.sizes.md, color: colors.text.secondary, marginTop: spacing.lg },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.lg },
  retryBtn: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, backgroundColor: colors.brand.primary, borderRadius: radius.full },
  retryBtnText: { color: colors.text.inverse, fontWeight: fonts.weights.semibold },
  signInBtn: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, backgroundColor: colors.brand.primary, borderRadius: radius.full },
  signInBtnText: { color: colors.text.inverse, fontWeight: fonts.weights.semibold },
});
