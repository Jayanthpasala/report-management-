import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../utils/api';
import { colors, spacing, radius, fonts } from '../utils/theme';

function fmt(amount: number, short = false): string {
  if (short) {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function SupplierDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsPage, setDocsPage] = useState(1);
  const [docsTotal, setDocsTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Edit Modal
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGst, setEditGst] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCountry, setEditCountry] = useState('India');
  const [gstValidation, setGstValidation] = useState<any>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchSupplier = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getSupplier(id);
      setSupplier(data);
      setEditName(data.name || '');
      setEditGst(data.gst_id || '');
      setEditCategory(data.category || 'General');
      setEditCountry(data.country || 'India');
    } catch (err) {
      console.error('Failed to fetch supplier:', err);
    }
  }, [id]);

  const fetchDocuments = useCallback(async (page = 1, append = false) => {
    if (!id) return;
    try {
      const data = await api.getSupplierDocuments(id, page);
      if (append) {
        setDocuments(prev => [...prev, ...data.documents]);
      } else {
        setDocuments(data.documents || []);
      }
      setDocsTotal(data.total || 0);
      setDocsPage(page);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, [id]);

  useEffect(() => {
    Promise.all([fetchSupplier(), fetchDocuments()])
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [fetchSupplier, fetchDocuments]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchSupplier(), fetchDocuments(1)])
      .finally(() => setRefreshing(false));
  };

  const loadMoreDocs = async () => {
    if (loadingMore || documents.length >= docsTotal) return;
    setLoadingMore(true);
    await fetchDocuments(docsPage + 1, true);
    setLoadingMore(false);
  };

  // GST Validation
  const handleValidateGST = async () => {
    if (!editGst.trim()) {
      setGstValidation(null);
      return;
    }
    try {
      const result = await api.validateGST(editGst.trim(), editCountry);
      setGstValidation(result);
    } catch (err: any) {
      setGstValidation({ valid: false, error: err.message });
    }
  };

  // Duplicate Check
  const handleCheckDuplicate = async () => {
    if (!editName.trim() || editName === supplier?.name) {
      setDuplicateWarnings([]);
      return;
    }
    try {
      const result = await api.checkSupplierDuplicate(editName.trim());
      // Filter out current supplier
      const filtered = (result.potential_duplicates || []).filter((d: any) => d.id !== id);
      setDuplicateWarnings(filtered);
    } catch (err) {
      console.error('Duplicate check failed:', err);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Supplier name is required');
      return;
    }

    // Check GST validity if provided
    if (editGst.trim() && gstValidation && !gstValidation.valid) {
      Alert.alert('Invalid GST', gstValidation.error || 'Please correct the GST/Tax ID');
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateSupplier(id!, {
        name: editName.trim(),
        gst_id: editGst.trim(),
        category: editCategory,
        country: editCountry,
      });

      if (result.warnings && result.warnings.length > 0) {
        Alert.alert(
          'Saved with Warnings',
          result.warnings.map((w: any) => w.message || `Similar name found: ${w.existing_name}`).join('\n'),
          [{ text: 'OK' }]
        );
      }

      setShowEdit(false);
      fetchSupplier();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update supplier');
    } finally {
      setSaving(false);
    }
  };

  const renderDocument = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`doc-${item.id}`}
      style={s.docCard}
      onPress={() => router.push({ pathname: '/document-detail', params: { doc_id: item.id } })}
      activeOpacity={0.7}
    >
      <View style={s.docHeader}>
        <View style={[s.docTypeIcon, { backgroundColor: getTypeColor(item.document_type) + '15' }]}>
          <Ionicons name={getTypeIcon(item.document_type)} size={18} color={getTypeColor(item.document_type)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.docType}>{formatDocType(item.document_type)}</Text>
          <Text style={s.docDate}>📅 {formatDate(item.document_date)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.docAmount}>{fmt(item.converted_inr_amount || item.extracted_data?.total_amount || 0)}</Text>
          {item.original_currency && item.original_currency !== 'INR' && (
            <Text style={s.docCurrency}>{item.original_currency}</Text>
          )}
        </View>
      </View>

      <View style={s.docMeta}>
        {item.extraction_confidence && (
          <View style={[s.confBadge, { backgroundColor: getConfColor(item.extraction_confidence) + '15' }]}>
            <Text style={[s.confText, { color: getConfColor(item.extraction_confidence) }]}>
              {Math.round(item.extraction_confidence * 100)}% AI
            </Text>
          </View>
        )}
        <View style={[s.statusBadge, { backgroundColor: item.status === 'processed' ? colors.brand.primary + '15' : colors.status.warning + '15' }]}>
          <Text style={[s.statusText, { color: item.status === 'processed' ? colors.brand.primary : colors.status.warning }]}>
            {item.status === 'processed' ? 'Verified' : 'Needs Review'}
          </Text>
        </View>
        {item.extracted_data?.invoice_number && (
          <Text style={s.invoiceNum}>#{item.extracted_data.invoice_number}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
      purchase_invoice: colors.status.info,
      sales_receipt: colors.brand.primary,
      expense_bill: colors.status.warning,
      aggregator_statement: colors.brand.secondary,
    };
    return map[type] || colors.text.muted;
  };

  const getTypeIcon = (type: string): any => {
    const map: Record<string, string> = {
      purchase_invoice: 'cart',
      sales_receipt: 'receipt',
      expense_bill: 'cash',
      aggregator_statement: 'phone-portrait',
    };
    return map[type] || 'document';
  };

  const formatDocType = (type: string) => {
    return (type || 'Document').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getConfColor = (conf: number) => {
    if (conf >= 0.8) return colors.brand.primary;
    if (conf >= 0.6) return colors.status.warning;
    return colors.status.error;
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{supplier?.name}</Text>
          <Text style={s.subtitle}>{supplier?.category} · {docsTotal} bills</Text>
        </View>
        <TouchableOpacity testID="edit-supplier-btn" style={s.editBtn} onPress={() => setShowEdit(true)}>
          <Ionicons name="pencil" size={18} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={item => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />
        }
        onEndReached={loadMoreDocs}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={() => (
          <>
            {/* Supplier Profile Card */}
            <View style={s.profileCard}>
              <View style={s.profileTop}>
                <View style={s.avatar}>
                  <Text style={s.avatarLetter}>{supplier?.name?.charAt(0)?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={s.profileName}>{supplier?.name}</Text>
                    {supplier?.is_verified && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.brand.primary} style={{ marginLeft: 6 }} />
                    )}
                  </View>
                  {supplier?.gst_id && (
                    <View style={s.gstRow}>
                      <Ionicons name="document-text-outline" size={14} color={colors.text.muted} />
                      <Text style={s.gstId}>{supplier.gst_id}</Text>
                    </View>
                  )}
                  <View style={s.catRow}>
                    <View style={s.catBadge}>
                      <Text style={s.catText}>{supplier?.category || 'General'}</Text>
                    </View>
                    <Text style={s.countryText}>📍 {supplier?.country || 'India'}</Text>
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{fmt(supplier?.total_spend || 0, true)}</Text>
                  <Text style={s.statLabel}>Total Spend</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statValue}>{supplier?.document_count || 0}</Text>
                  <Text style={s.statLabel}>Bills</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statValue}>{fmt(supplier?.avg_invoice || 0, true)}</Text>
                  <Text style={s.statLabel}>Avg Invoice</Text>
                </View>
              </View>

              {/* Monthly Trend */}
              {supplier?.monthly_trend && supplier.monthly_trend.length > 0 && (
                <View style={s.trendSection}>
                  <Text style={s.trendTitle}>📊 Monthly Spend Trend</Text>
                  <View style={s.trendRow}>
                    {supplier.monthly_trend.slice(0, 4).reverse().map((m: any) => (
                      <View key={m.month} style={s.trendItem}>
                        <View style={[s.trendBar, { height: Math.max(10, (m.spend / (supplier.monthly_trend[0]?.spend || 1)) * 40) }]} />
                        <Text style={s.trendMonth}>{m.month?.slice(5)}</Text>
                        <Text style={s.trendSpend}>{fmt(m.spend, true)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <Text style={s.sectionTitle}>📄 DOCUMENTS ({docsTotal})</Text>
          </>
        )}
        ListEmptyComponent={() => (
          <View style={s.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.text.muted} />
            <Text style={s.emptyText}>No documents from this supplier</Text>
          </View>
        )}
        ListFooterComponent={() => (
          loadingMore ? (
            <View style={s.loadingMore}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : null
        )}
      />

      {/* Edit Supplier Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Edit Supplier</Text>
                <TouchableOpacity onPress={() => setShowEdit(false)}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {/* Name Input with Duplicate Warning */}
                <Text style={s.inputLabel}>Supplier Name *</Text>
                <TextInput
                  testID="edit-name-input"
                  style={s.input}
                  value={editName}
                  onChangeText={setEditName}
                  onBlur={handleCheckDuplicate}
                  placeholder="Supplier name"
                  placeholderTextColor={colors.text.muted}
                />
                {duplicateWarnings.length > 0 && (
                  <View style={s.warningBox}>
                    <Ionicons name="warning" size={16} color={colors.status.warning} />
                    <Text style={s.warningText}>
                      Similar supplier: {duplicateWarnings[0].existing_name} ({duplicateWarnings[0].similarity}% match)
                    </Text>
                  </View>
                )}

                {/* GST Input with Validation */}
                <Text style={s.inputLabel}>GST/Tax ID</Text>
                <View style={s.inputRow}>
                  <TextInput
                    testID="edit-gst-input"
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={editGst}
                    onChangeText={text => { setEditGst(text.toUpperCase()); setGstValidation(null); }}
                    onBlur={handleValidateGST}
                    placeholder={editCountry === 'India' ? '27AABCU9603R1ZM' : 'Tax ID'}
                    placeholderTextColor={colors.text.muted}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity testID="validate-gst-btn" style={s.validateBtn} onPress={handleValidateGST}>
                    <Text style={s.validateBtnText}>Validate</Text>
                  </TouchableOpacity>
                </View>
                {gstValidation && (
                  <View style={[s.validationBox, gstValidation.valid ? s.validationSuccess : s.validationError]}>
                    <Ionicons 
                      name={gstValidation.valid ? 'checkmark-circle' : 'alert-circle'} 
                      size={16} 
                      color={gstValidation.valid ? colors.brand.primary : colors.status.error} 
                    />
                    <Text style={[s.validationText, { color: gstValidation.valid ? colors.brand.primary : colors.status.error }]}>
                      {gstValidation.valid ? 'Valid GST format' : gstValidation.error}
                    </Text>
                    {gstValidation.existing_supplier && (
                      <Text style={s.existingText}>⚠️ Already assigned to: {gstValidation.existing_supplier.name}</Text>
                    )}
                  </View>
                )}

                {/* Category */}
                <Text style={s.inputLabel}>Category</Text>
                <View style={s.categoryRow}>
                  {['General', 'Wholesale', 'Produce', 'FMCG', 'Aggregator', 'Services'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      testID={`cat-${cat}`}
                      style={[s.categoryChip, editCategory === cat && s.categoryChipActive]}
                      onPress={() => setEditCategory(cat)}
                    >
                      <Text style={[s.categoryChipText, editCategory === cat && s.categoryChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Country */}
                <Text style={s.inputLabel}>Country</Text>
                <View style={s.categoryRow}>
                  {['India', 'UAE', 'Singapore', 'USA', 'UK'].map(c => (
                    <TouchableOpacity
                      key={c}
                      testID={`country-${c}`}
                      style={[s.categoryChip, editCountry === c && s.categoryChipActive]}
                      onPress={() => { setEditCountry(c); setGstValidation(null); }}
                    >
                      <Text style={[s.categoryChipText, editCountry === c && s.categoryChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <TouchableOpacity
                testID="save-supplier-btn"
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <Text style={s.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: fonts.sizes.xs, color: colors.text.secondary, marginTop: 1 },
  editBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.default },

  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  profileCard: { backgroundColor: colors.background.surface, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border.default },
  profileTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.brand.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg },
  avatarLetter: { fontSize: fonts.sizes.xxl, fontWeight: fonts.weights.bold, color: colors.brand.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  profileName: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  gstRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  gstId: { fontSize: fonts.sizes.sm, color: colors.text.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  catBadge: { backgroundColor: colors.brand.secondary + '15', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  catText: { fontSize: fonts.sizes.xs, color: colors.brand.secondary, fontWeight: fonts.weights.semibold },
  countryText: { fontSize: fonts.sizes.xs, color: colors.text.muted },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.default },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border.default },

  trendSection: { paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.default, marginTop: spacing.lg },
  trendTitle: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginBottom: spacing.md },
  trendRow: { flexDirection: 'row', justifyContent: 'space-around' },
  trendItem: { alignItems: 'center' },
  trendBar: { width: 24, backgroundColor: colors.brand.primary + '40', borderRadius: radius.sm, marginBottom: spacing.xs },
  trendMonth: { fontSize: 10, color: colors.text.muted },
  trendSpend: { fontSize: 10, color: colors.text.secondary, fontWeight: fonts.weights.medium },

  sectionTitle: { fontSize: fonts.sizes.sm, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },

  docCard: { backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.default },
  docHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  docTypeIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  docType: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  docDate: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },
  docAmount: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  docCurrency: { fontSize: fonts.sizes.xs, color: colors.status.info, marginTop: 2 },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  confBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  confText: { fontSize: 10, fontWeight: fonts.weights.semibold },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: fonts.weights.semibold },
  invoiceNum: { fontSize: fonts.sizes.xs, color: colors.text.muted },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.lg },

  loadingMore: { paddingVertical: spacing.xl },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: colors.background.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  modalTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },

  inputLabel: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.background.default, borderRadius: radius.md, padding: spacing.lg, color: colors.text.primary, fontSize: fonts.sizes.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.default },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
  validateBtn: { backgroundColor: colors.brand.secondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  validateBtnText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.inverse },

  warningBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.status.warning + '15', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  warningText: { fontSize: fonts.sizes.sm, color: colors.status.warning, flex: 1 },

  validationBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' },
  validationSuccess: { backgroundColor: colors.brand.primary + '15' },
  validationError: { backgroundColor: colors.status.error + '15' },
  validationText: { fontSize: fonts.sizes.sm, flex: 1 },
  existingText: { fontSize: fonts.sizes.xs, color: colors.status.warning, width: '100%', marginTop: spacing.xs },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background.default, borderWidth: 1, borderColor: colors.border.default },
  categoryChipActive: { backgroundColor: colors.brand.primary + '15', borderColor: colors.brand.primary },
  categoryChipText: { fontSize: fonts.sizes.sm, color: colors.text.secondary },
  categoryChipTextActive: { color: colors.brand.primary, fontWeight: fonts.weights.medium },

  saveBtn: { backgroundColor: colors.brand.primary, borderRadius: radius.full, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.text.inverse },
});
