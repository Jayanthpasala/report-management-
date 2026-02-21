import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { colors, spacing, radius, fonts } from '../../utils/theme';

const DOC_TYPE_ICONS: Record<string, string> = {
  purchase_invoice: 'cart',
  sales_receipt: 'receipt',
  aggregator_statement: 'phone-portrait',
  expense_bill: 'wallet',
  utility_bill: 'flash',
};

export default function DocumentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [total, setTotal] = useState(0);

  const fetchDocs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filter !== 'all') params.document_type = filter;
      const res = await api.listDocuments(params);
      setDocuments(res.documents || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, filter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const renderDoc = ({ item }: { item: any }) => {
    const iconName = DOC_TYPE_ICONS[item.document_type] || 'document';
    const confidenceColor = item.extraction_confidence > 0.7 ? colors.brand.primary :
                            item.extraction_confidence > 0.5 ? colors.status.warning : colors.status.error;
    return (
      <TouchableOpacity
        testID={`doc-item-${item.id}`}
        style={s.docCard}
        onPress={() => router.push({ pathname: '/document-detail', params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={s.docLeft}>
          <View style={[s.docIcon, { backgroundColor: confidenceColor + '15' }]}>
            <Ionicons name={iconName as any} size={22} color={confidenceColor} />
          </View>
        </View>
        <View style={s.docInfo}>
          <Text style={s.docSupplier} numberOfLines={1}>{item.supplier_name || 'Unknown'}</Text>
          <Text style={s.docType}>{item.document_type?.replace(/_/g, ' ')}</Text>
          <Text style={s.docDate}>
            {item.document_date || 'No date'} · {item.original_filename}
          </Text>
        </View>
        <View style={s.docRight}>
          <Text style={s.docAmount}>
            ₹{(item.extracted_data?.total_amount || item.converted_inr_amount || 0).toLocaleString()}
          </Text>
          {item.requires_review && (
            <View style={s.reviewBadge}>
              <Text style={s.reviewBadgeText}>Review</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <Text style={s.title}>Document Vault</Text>
        <Text style={s.count}>{total} documents</Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            testID="doc-search-input"
            style={s.searchInput}
            placeholder="Search supplier, filename..."
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={s.filterRow}>
        {['all', 'purchase_invoice', 'sales_receipt', 'aggregator_statement', 'expense_bill'].map(f => (
          <TouchableOpacity
            key={f}
            testID={`filter-${f}`}
            style={[s.filterChip, f === filter && s.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterChipText, f === filter && s.filterChipTextActive]}>
              {f === 'all' ? 'All' : f.replace(/_/g, ' ').split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDoc}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDocs(); }} tintColor={colors.brand.primary} />
          }
          ListEmptyComponent={
            <View style={s.centered}>
              <Ionicons name="folder-open-outline" size={48} color={colors.text.muted} />
              <Text style={s.emptyText}>No documents found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  count: { fontSize: fonts.sizes.sm, color: colors.text.muted },
  searchRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 44, borderWidth: 1, borderColor: colors.border.default,
  },
  searchInput: { flex: 1, color: colors.text.primary, fontSize: fonts.sizes.md },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.background.surface,
    borderWidth: 1, borderColor: colors.border.default,
  },
  filterChipActive: { backgroundColor: colors.brand.primary + '20', borderColor: colors.brand.primary },
  filterChipText: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  filterChipTextActive: { color: colors.brand.primary, fontWeight: fonts.weights.semibold },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  docCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border.default,
  },
  docLeft: { marginRight: spacing.md },
  docIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1 },
  docSupplier: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  docType: { fontSize: fonts.sizes.xs, color: colors.text.muted, textTransform: 'capitalize', marginTop: 2 },
  docDate: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },
  docRight: { alignItems: 'flex-end', marginLeft: spacing.sm },
  docAmount: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.text.primary },
  reviewBadge: {
    backgroundColor: colors.status.warning + '20', paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.sm, marginTop: spacing.xs,
  },
  reviewBadgeText: { fontSize: 10, color: colors.status.warning, fontWeight: fonts.weights.semibold },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.lg },
});
