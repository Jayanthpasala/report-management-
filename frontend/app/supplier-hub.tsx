import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { colors, spacing, radius, fonts } from '../utils/theme';

function fmt(amount: number, short = false): string {
  if (short) {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function SupplierHubScreen() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGst, setNewGst] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.listSuppliers();
      setSuppliers(res.suppliers || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const filtered = search
    ? suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.gst_id || '').includes(search))
    : suppliers;

  const totalSpend = suppliers.reduce((sum, s) => sum + (s.total_spend || 0), 0);
  const totalDocs = suppliers.reduce((sum, s) => sum + (s.document_count || 0), 0);

  const addSupplier = async () => {
    if (!newName.trim()) { Alert.alert('Error', 'Supplier name required'); return; }
    try {
      await api.createSupplier({ name: newName.trim(), gst_id: newGst.trim(), category: newCategory.trim() || 'General' });
      setShowAdd(false);
      setNewName(''); setNewGst(''); setNewCategory('');
      fetchSuppliers();
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const renderSupplier = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`supplier-${item.id}`}
      style={s.card}
      onPress={() => router.push({ pathname: '/supplier-detail', params: { id: item.id } })}
      activeOpacity={0.7}
    >
      <View style={s.cardTop}>
        <View style={s.supplierAvatar}>
          <Text style={s.avatarLetter}>{item.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <View style={s.cardInfo}>
          <Text style={s.supplierName} numberOfLines={1}>{item.name}</Text>
          <View style={s.metaRow}>
            {item.gst_id && <Text style={s.gstText}>GST: {item.gst_id.slice(0, 10)}...</Text>}
            {item.category && <View style={s.catBadge}><Text style={s.catText}>{item.category}</Text></View>}
          </View>
        </View>
        {item.is_verified && <Ionicons name="checkmark-circle" size={18} color={colors.brand.primary} />}
      </View>
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statValue}>{fmt(item.total_spend || 0, true)}</Text>
          <Text style={s.statLabel}>Total Spend</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>{item.document_count || 0}</Text>
          <Text style={s.statLabel}>Bills</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>{fmt(item.avg_invoice || 0, true)}</Text>
          <Text style={s.statLabel}>Avg Invoice</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>{item.last_document_date?.slice(5) || '—'}</Text>
          <Text style={s.statLabel}>Last Bill</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Supplier Hub</Text>
          <Text style={s.subtitle}>{suppliers.length} suppliers · {fmt(totalSpend, true)} total spend</Text>
        </View>
        <TouchableOpacity testID="add-supplier-btn" style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { borderLeftColor: colors.brand.primary }]}>
          <Text style={s.summaryValue}>{fmt(totalSpend, true)}</Text>
          <Text style={s.summaryLabel}>Total Spend</Text>
        </View>
        <View style={[s.summaryCard, { borderLeftColor: colors.status.info }]}>
          <Text style={s.summaryValue}>{totalDocs}</Text>
          <Text style={s.summaryLabel}>Total Bills</Text>
        </View>
        <View style={[s.summaryCard, { borderLeftColor: colors.brand.secondary }]}>
          <Text style={s.summaryValue}>{suppliers.length}</Text>
          <Text style={s.summaryLabel}>Suppliers</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput testID="supplier-search" style={s.searchInput} placeholder="Search supplier or GST..." placeholderTextColor={colors.text.muted} value={search} onChangeText={setSearch} />
        </View>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={colors.brand.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderSupplier}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSuppliers(); }} tintColor={colors.brand.primary} />}
          ListEmptyComponent={<View style={s.centered}><Ionicons name="people-outline" size={48} color={colors.text.muted} /><Text style={s.emptyText}>No suppliers found</Text></View>}
        />
      )}

      {/* Add Supplier Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Supplier</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={24} color={colors.text.primary} /></TouchableOpacity>
            </View>
            <TextInput testID="new-supplier-name" style={s.input} placeholder="Supplier Name *" placeholderTextColor={colors.text.muted} value={newName} onChangeText={setNewName} />
            <TextInput testID="new-supplier-gst" style={s.input} placeholder="GST Number (optional)" placeholderTextColor={colors.text.muted} value={newGst} onChangeText={setNewGst} />
            <TextInput testID="new-supplier-category" style={s.input} placeholder="Category (e.g. Wholesale, Produce)" placeholderTextColor={colors.text.muted} value={newCategory} onChangeText={setNewCategory} />
            <TouchableOpacity testID="save-supplier-btn" style={s.saveBtn} onPress={addSupplier}>
              <Text style={s.saveBtnText}>Add Supplier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: fonts.sizes.xs, color: colors.text.secondary, marginTop: 1 },
  addBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },

  summaryRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border.default },
  summaryValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  summaryLabel: { fontSize: 10, color: colors.text.muted, marginTop: 1 },

  searchRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background.surface, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 44, borderWidth: 1, borderColor: colors.border.default },
  searchInput: { flex: 1, color: colors.text.primary, fontSize: fonts.sizes.md },

  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.default },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  supplierAvatar: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarLetter: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.brand.primary },
  cardInfo: { flex: 1 },
  supplierName: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  gstText: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  catBadge: { backgroundColor: colors.brand.secondary + '15', paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  catText: { fontSize: 10, color: colors.brand.secondary, fontWeight: fonts.weights.semibold },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.text.primary },
  statLabel: { fontSize: 10, color: colors.text.muted, marginTop: 1 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  modalTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  input: { backgroundColor: colors.background.default, borderRadius: radius.md, padding: spacing.lg, color: colors.text.primary, fontSize: fonts.sizes.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.default },
  saveBtn: { backgroundColor: colors.brand.primary, borderRadius: radius.full, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  saveBtnText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.inverse },
});
