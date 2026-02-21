import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { colors, spacing, radius, fonts } from '../../utils/theme';

const DOC_TYPE_ICONS: Record<string, string> = {
  purchase_invoice: 'cart', sales_receipt: 'receipt',
  aggregator_statement: 'phone-portrait', expense_bill: 'wallet', utility_bill: 'flash',
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
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchDocs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filter !== 'all') params.document_type = filter;
      const res = await api.listDocuments(params);
      setDocuments(res.documents || []);
      setTotal(res.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [search, filter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === documents.length) setSelected(new Set());
    else setSelected(new Set(documents.map(d => d.id)));
  };

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    const label = action === 'approve' ? 'approve' : action === 'delete' ? 'delete' : 'flag for review';
    Alert.alert(`Bulk ${label}`, `${label} ${selected.size} documents?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', style: action === 'delete' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await api.bulkAction(action, Array.from(selected));
            setSelected(new Set());
            setBulkMode(false);
            fetchDocs();
          } catch (err: any) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  };

  const renderDoc = ({ item }: { item: any }) => {
    const iconName = DOC_TYPE_ICONS[item.document_type] || 'document';
    const confColor = item.extraction_confidence > 0.7 ? colors.brand.primary :
                      item.extraction_confidence > 0.5 ? colors.status.warning : colors.status.error;
    const isSelected = selected.has(item.id);

    return (
      <TouchableOpacity
        testID={`doc-item-${item.id}`}
        style={[s.docCard, isSelected && s.docCardSelected]}
        onPress={() => bulkMode ? toggleSelect(item.id) : router.push({ pathname: '/document-detail', params: { id: item.id } })}
        onLongPress={() => { setBulkMode(true); toggleSelect(item.id); }}
        activeOpacity={0.7}
      >
        {bulkMode && (
          <View style={s.checkbox}>
            <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={22} color={isSelected ? colors.brand.primary : colors.text.muted} />
          </View>
        )}
        <View style={s.docLeft}>
          <View style={[s.docIcon, { backgroundColor: confColor + '15' }]}>
            <Ionicons name={iconName as any} size={22} color={confColor} />
          </View>
        </View>
        <View style={s.docInfo}>
          <Text style={s.docSupplier} numberOfLines={1}>{item.supplier_name || 'Unknown'}</Text>
          <Text style={s.docType}>{item.document_type?.replace(/_/g, ' ')}</Text>
          <View style={s.docMeta}>
            <Text style={s.docDate}>{item.document_date || 'No date'}</Text>
            {item.original_currency && item.original_currency !== 'INR' && (
              <View style={s.currencyBadge}>
                <Text style={s.currencyText}>{item.original_currency}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.docRight}>
          <Text style={s.docAmount}>
            ₹{(item.extracted_data?.total_amount || item.converted_inr_amount || 0).toLocaleString()}
          </Text>
          {item.requires_review && (
            <View style={s.reviewBadge}><Text style={s.reviewBadgeText}>Review</Text></View>
          )}
          <Text style={[s.confLabel, { color: confColor }]}>{(item.extraction_confidence * 100).toFixed(0)}% AI</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <Text style={s.title}>Document Vault</Text>
        <View style={s.headerRight}>
          <Text style={s.count}>{total} docs</Text>
          {(user?.role === 'owner' || user?.role === 'accounts') && (
            <TouchableOpacity testID="bulk-mode-btn" style={s.bulkToggle} onPress={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}>
              <Ionicons name={bulkMode ? 'close' : 'checkbox-outline'} size={18} color={bulkMode ? colors.status.error : colors.brand.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bulk Actions Bar */}
      {bulkMode && (
        <View testID="bulk-actions-bar" style={s.bulkBar}>
          <TouchableOpacity onPress={selectAll} style={s.bulkSelectAll}>
            <Text style={s.bulkSelectAllText}>{selected.size === documents.length ? 'Deselect All' : `Select All (${documents.length})`}</Text>
          </TouchableOpacity>
          <View style={s.bulkActions}>
            <TouchableOpacity testID="bulk-approve-btn" style={s.bulkBtn} onPress={() => handleBulkAction('approve')}>
              <Ionicons name="checkmark" size={16} color={colors.brand.primary} />
              <Text style={[s.bulkBtnText, { color: colors.brand.primary }]}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="bulk-flag-btn" style={s.bulkBtn} onPress={() => handleBulkAction('flag_review')}>
              <Ionicons name="flag" size={16} color={colors.status.warning} />
              <Text style={[s.bulkBtnText, { color: colors.status.warning }]}>Flag</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="bulk-delete-btn" style={s.bulkBtn} onPress={() => handleBulkAction('delete')}>
              <Ionicons name="trash" size={16} color={colors.status.error} />
              <Text style={[s.bulkBtnText, { color: colors.status.error }]}>Del</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.bulkCount}>{selected.size} selected</Text>
        </View>
      )}

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput testID="doc-search-input" style={s.searchInput} placeholder="Search supplier, filename..." placeholderTextColor={colors.text.muted} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.text.muted} /></TouchableOpacity> : null}
        </View>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {['all', 'purchase_invoice', 'sales_receipt', 'aggregator_statement', 'expense_bill'].map(f => (
          <TouchableOpacity key={f} testID={`filter-${f}`} style={[s.filterChip, f === filter && s.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterChipText, f === filter && s.filterChipTextActive]}>
              {f === 'all' ? 'All' : f.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={colors.brand.primary} /></View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDoc}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDocs(); }} tintColor={colors.brand.primary} />}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  count: { fontSize: fonts.sizes.sm, color: colors.text.muted },
  bulkToggle: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.default },
  // Bulk Bar
  bulkBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, backgroundColor: colors.background.elevated, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  bulkSelectAll: { marginRight: spacing.md },
  bulkSelectAllText: { fontSize: fonts.sizes.xs, color: colors.brand.primary, fontWeight: fonts.weights.semibold },
  bulkActions: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  bulkBtnText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },
  bulkCount: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  // Search
  searchRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background.surface, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 44, borderWidth: 1, borderColor: colors.border.default },
  searchInput: { flex: 1, color: colors.text.primary, fontSize: fonts.sizes.md },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.background.surface, borderWidth: 1, borderColor: colors.border.default },
  filterChipActive: { backgroundColor: colors.brand.primary + '20', borderColor: colors.brand.primary },
  filterChipText: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  filterChipTextActive: { color: colors.brand.primary, fontWeight: fonts.weights.semibold },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border.default },
  docCardSelected: { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary + '08' },
  checkbox: { marginRight: spacing.sm },
  docLeft: { marginRight: spacing.md },
  docIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1 },
  docSupplier: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  docType: { fontSize: fonts.sizes.xs, color: colors.text.muted, textTransform: 'capitalize', marginTop: 2 },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  docDate: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  currencyBadge: { backgroundColor: colors.status.info + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  currencyText: { fontSize: 9, fontWeight: '700', color: colors.status.info },
  docRight: { alignItems: 'flex-end', marginLeft: spacing.sm },
  docAmount: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.text.primary },
  reviewBadge: { backgroundColor: colors.status.warning + '20', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: spacing.xs },
  reviewBadgeText: { fontSize: 10, color: colors.status.warning, fontWeight: fonts.weights.semibold },
  confLabel: { fontSize: 9, fontWeight: '600', marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.lg },
});
