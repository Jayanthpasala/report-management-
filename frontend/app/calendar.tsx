import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { colors, spacing, radius, fonts } from '../utils/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const { outlet_id } = useLocalSearchParams<{ outlet_id: string }>();
  const { user, outlets } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const oid = outlet_id || user?.outlet_ids?.[0] || '';
  const outletName = outlets.find((o: any) => o.id === oid)?.name || 'Outlet';

  useEffect(() => {
    if (!oid) { setLoading(false); return; }
    setLoading(true);
    api.calendar(oid, year, month).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [oid, year, month]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  // Calculate first day offset (Monday = 0)
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const statusColor = (status: string) => {
    switch (status) {
      case 'complete': return colors.brand.primary;
      case 'partial': return colors.status.warning;
      case 'missing': return colors.status.error;
      default: return colors.background.overlay;
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.outletName}>{outletName}</Text>

        {/* Month Navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity testID="prev-month-btn" onPress={prevMonth} style={s.navBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={s.monthTitle}>{monthName} {year}</Text>
          <TouchableOpacity testID="next-month-btn" onPress={nextMonth} style={s.navBtn}>
            <Ionicons name="chevron-forward" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : data ? (
          <>
            {/* Summary */}
            <View style={s.summaryRow}>
              <View style={[s.summaryChip, { backgroundColor: colors.brand.primary + '20' }]}>
                <View style={[s.sumDot, { backgroundColor: colors.brand.primary }]} />
                <Text style={[s.summaryText, { color: colors.brand.primary }]}>{data.summary?.complete || 0} Complete</Text>
              </View>
              <View style={[s.summaryChip, { backgroundColor: colors.status.warning + '20' }]}>
                <View style={[s.sumDot, { backgroundColor: colors.status.warning }]} />
                <Text style={[s.summaryText, { color: colors.status.warning }]}>{data.summary?.partial || 0} Partial</Text>
              </View>
              <View style={[s.summaryChip, { backgroundColor: colors.status.error + '20' }]}>
                <View style={[s.sumDot, { backgroundColor: colors.status.error }]} />
                <Text style={[s.summaryText, { color: colors.status.error }]}>{data.summary?.missing || 0} Missing</Text>
              </View>
            </View>

            {/* Calendar Grid */}
            <View style={s.calendarGrid}>
              {/* Weekday Headers */}
              {WEEKDAYS.map(d => (
                <View key={d} style={s.weekdayCell}>
                  <Text style={s.weekdayText}>{d}</Text>
                </View>
              ))}

              {/* Empty cells for offset */}
              {Array.from({ length: offset }).map((_, i) => (
                <View key={`empty-${i}`} style={s.dayCell} />
              ))}

              {/* Days */}
              {data.days?.map((day: any) => (
                <TouchableOpacity
                  key={day.date}
                  testID={`calendar-day-${day.day}`}
                  style={[s.dayCell, { backgroundColor: statusColor(day.status) + '15' }]}
                >
                  <Text style={[s.dayNumber, day.status === 'future' && { color: colors.text.muted }]}>
                    {day.day}
                  </Text>
                  {day.status !== 'future' && (
                    <View style={[s.statusDot, { backgroundColor: statusColor(day.status) }]} />
                  )}
                  {day.documents_count > 0 && (
                    <Text style={s.docCount}>{day.documents_count}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Legend */}
            <View style={s.legend}>
              <Text style={s.legendTitle}>Legend</Text>
              <View style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: colors.brand.primary }]} />
                <Text style={s.legendText}>All required reports present</Text>
              </View>
              <View style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: colors.status.warning }]} />
                <Text style={s.legendText}>Some reports missing</Text>
              </View>
              <View style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: colors.status.error }]} />
                <Text style={s.legendText}>No reports uploaded</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={s.centered}>
            <Text style={s.emptyText}>No data available</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  outletName: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginBottom: spacing.sm },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  navBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl, flexWrap: 'wrap' },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  sumDot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekdayCell: { width: '14.28%', alignItems: 'center', paddingVertical: spacing.sm },
  weekdayText: { fontSize: fonts.sizes.xs, color: colors.text.muted, fontWeight: fonts.weights.semibold },
  dayCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, marginBottom: 2,
  },
  dayNumber: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  docCount: { fontSize: 8, color: colors.text.muted, marginTop: 1 },

  legend: {
    marginTop: spacing.xxl, backgroundColor: colors.background.surface,
    borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default,
  },
  legendTitle: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary, marginBottom: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: fonts.sizes.sm, color: colors.text.secondary },

  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted },
});
