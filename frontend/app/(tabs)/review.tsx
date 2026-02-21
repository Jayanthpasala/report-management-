import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { colors, spacing, radius, fonts } from '../../utils/theme';

export default function ReviewScreen() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.getReviewQueue();
      setDocuments(res.documents || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const approveDoc = async (doc: any) => {
    setProcessing(doc.id);
    try {
      await api.updateDocument(doc.id, { status: 'processed' });
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setProcessing(null);
    }
  };

  const renderDoc = ({ item }: { item: any }) => {
    const confidence = (item.extraction_confidence * 100).toFixed(0);
    const confColor = item.extraction_confidence > 0.5 ? colors.status.warning : colors.status.error;
    return (
      <View testID={`review-item-${item.id}`} style={s.card}>
        <View style={s.cardHeader}>
          <View style={[s.confBadge, { backgroundColor: confColor + '20', borderColor: confColor + '40' }]}>
            <Text style={[s.confText, { color: confColor }]}>{confidence}% AI</Text>
          </View>
          <Text style={s.cardDate}>{item.document_date || 'No date'}</Text>
        </View>

        <Text style={s.supplierName}>{item.supplier_name || 'Unknown Supplier'}</Text>
        <Text style={s.docType}>{item.document_type?.replace(/_/g, ' ')}</Text>

        <View style={s.detailRow}>
          <View style={s.detailItem}>
            <Text style={s.detailLabel}>Amount</Text>
            <Text style={s.detailValue}>₹{(item.extracted_data?.total_amount || 0).toLocaleString()}</Text>
          </View>
          <View style={s.detailItem}>
            <Text style={s.detailLabel}>File</Text>
            <Text style={s.detailValue} numberOfLines={1}>{item.original_filename}</Text>
          </View>
          <View style={s.detailItem}>
            <Text style={s.detailLabel}>By</Text>
            <Text style={s.detailValue}>{item.uploader_name}</Text>
          </View>
        </View>

        {/* Issues */}
        <View style={s.issueRow}>
          {!item.document_date && (
            <View style={s.issueChip}>
              <Ionicons name="calendar-outline" size={12} color={colors.status.error} />
              <Text style={s.issueText}>Missing Date</Text>
            </View>
          )}
          {item.extraction_confidence < 0.5 && (
            <View style={s.issueChip}>
              <Ionicons name="eye-off-outline" size={12} color={colors.status.error} />
              <Text style={s.issueText}>Low OCR</Text>
            </View>
          )}
          {!item.supplier_id && (
            <View style={s.issueChip}>
              <Ionicons name="help-circle-outline" size={12} color={colors.status.warning} />
              <Text style={s.issueText}>Unmatched Supplier</Text>
            </View>
          )}
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            testID={`approve-btn-${item.id}`}
            style={s.approveBtn}
            onPress={() => approveDoc(item)}
            disabled={processing === item.id}
          >
            {processing === item.id ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.text.inverse} />
                <Text style={s.approveBtnText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity testID={`edit-btn-${item.id}`} style={s.editBtn}>
            <Ionicons name="create-outline" size={18} color={colors.brand.primary} />
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Review Queue</Text>
          <Text style={s.subtitle}>{documents.length} documents need attention</Text>
        </View>
        {documents.length > 0 && (
          <View style={s.urgencyBadge}>
            <Ionicons name="alert-circle" size={16} color={colors.status.error} />
            <Text style={s.urgencyText}>{documents.length}</Text>
          </View>
        )}
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
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(); }} tintColor={colors.brand.primary} />
          }
          ListEmptyComponent={
            <View style={s.centered}>
              <View style={s.emptyIcon}>
                <Ionicons name="checkmark-circle" size={64} color={colors.brand.primary} />
              </View>
              <Text style={s.emptyTitle}>All Clear!</Text>
              <Text style={s.emptyText}>No documents need review</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
  },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.status.error + '20', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  urgencyText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.status.error },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.background.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border.default,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  confBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1,
  },
  confText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },
  cardDate: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  supplierName: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  docType: { fontSize: fonts.sizes.sm, color: colors.text.muted, textTransform: 'capitalize', marginTop: 2 },
  detailRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.lg },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: fonts.sizes.xs, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary, marginTop: 2 },
  issueRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  issueChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.status.error + '10', paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.sm,
  },
  issueText: { fontSize: 10, color: colors.status.error },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.brand.primary, borderRadius: radius.md, height: 44,
  },
  approveBtnText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.inverse },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.background.overlay, borderRadius: radius.md, height: 44,
    borderWidth: 1, borderColor: colors.brand.primary + '40',
  },
  editBtnText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.medium, color: colors.brand.primary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { marginBottom: spacing.lg },
  emptyTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted, marginTop: spacing.xs },
});
