import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../utils/api';
import { colors, spacing, radius, fonts } from '../utils/theme';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getDocument(id),
      api.getDocumentVersions(id).catch(() => ({ versions: [] })),
    ]).then(([d, v]) => {
      setDoc(d);
      setVersions(v.versions || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SafeAreaView style={s.safeArea} edges={['bottom']}><View style={s.centered}><ActivityIndicator size="large" color={colors.brand.primary} /></View></SafeAreaView>;
  if (!doc) return <SafeAreaView style={s.safeArea} edges={['bottom']}><View style={s.centered}><Text style={s.emptyText}>Document not found</Text></View></SafeAreaView>;

  const confidence = (doc.extraction_confidence * 100).toFixed(0);
  const confColor = doc.extraction_confidence > 0.7 ? colors.brand.primary : doc.extraction_confidence > 0.5 ? colors.status.warning : colors.status.error;

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Status + Version Badge */}
        <View style={s.topRow}>
          <View style={[s.statusBadge, { backgroundColor: doc.requires_review ? colors.status.warning + '20' : colors.brand.primary + '20' }]}>
            <Ionicons name={doc.requires_review ? 'alert-circle' : 'checkmark-circle'} size={20} color={doc.requires_review ? colors.status.warning : colors.brand.primary} />
            <Text style={[s.statusText, { color: doc.requires_review ? colors.status.warning : colors.brand.primary }]}>{doc.requires_review ? 'Needs Review' : 'Processed'}</Text>
          </View>
          <View style={s.versionBadge}>
            <Text style={s.versionText}>v{doc.version_number || 1}</Text>
          </View>
        </View>

        {/* AI Extraction Card */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>AI Extraction</Text>
            <View style={s.providerChip}>
              <Ionicons name="sparkles" size={12} color={colors.brand.secondary} />
              <Text style={s.providerText}>{doc.ai_provider_used || 'AI'}</Text>
            </View>
          </View>
          <View style={s.confBar}><View style={[s.confFill, { width: `${confidence}%`, backgroundColor: confColor }]} /></View>
          <Text style={[s.confValue, { color: confColor }]}>{confidence}% Confidence</Text>
          {doc.extraction_method && <Text style={s.methodText}>Method: {doc.extraction_method}</Text>}
        </View>

        {/* Document Details */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Document Details</Text>
          <DetailRow label="Type" value={doc.document_type?.replace(/_/g, ' ')} />
          <DetailRow label="Document Date" value={doc.document_date || 'Not detected'} highlight={!doc.document_date} />
          <DetailRow label="Upload Date" value={doc.upload_timestamp?.slice(0, 10)} />
          <DetailRow label="Supplier" value={doc.supplier_name} />
          <DetailRow label="File" value={doc.original_filename} />
          <DetailRow label="Currency" value={doc.original_currency || doc.extracted_data?.currency} />
          {doc.exchange_rate && doc.exchange_rate !== 1 && (
            <>
              <DetailRow label="Exchange Rate" value={`1 ${doc.original_currency} = ₹${doc.exchange_rate}`} />
              <DetailRow label="Rate Source" value={doc.rate_source || 'N/A'} />
            </>
          )}
        </View>

        {/* Financial Data */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Financial Data</Text>
          <DetailRow label="Subtotal" value={`₹${doc.extracted_data?.subtotal?.toLocaleString()}`} />
          <DetailRow label="Tax" value={`₹${doc.extracted_data?.tax_amount?.toLocaleString()}`} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>₹{doc.extracted_data?.total_amount?.toLocaleString()}</Text>
          </View>
          {doc.converted_inr_amount && doc.converted_inr_amount !== doc.extracted_data?.total_amount && (
            <DetailRow label="Converted (INR)" value={`₹${doc.converted_inr_amount?.toLocaleString()}`} />
          )}
        </View>

        {/* Line Items */}
        {doc.extracted_data?.line_items?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Line Items ({doc.extracted_data.line_items.length})</Text>
            {doc.extracted_data.line_items.map((item: any, i: number) => (
              <View key={i} style={s.lineItem}>
                <View style={s.lineLeft}>
                  <Text style={s.lineDesc}>{item.description}</Text>
                  <View style={s.lineMetaRow}>
                    {item.quantity > 0 && <Text style={s.lineQty}>Qty: {item.quantity}</Text>}
                    {item.category && <Text style={s.lineCategory}>{item.category}</Text>}
                  </View>
                </View>
                <Text style={s.lineAmount}>₹{item.amount?.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* OCR Raw Text */}
        {doc.raw_ocr_text && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Raw OCR Text</Text>
            <Text style={s.ocrText} numberOfLines={10}>{doc.raw_ocr_text}</Text>
          </View>
        )}

        {/* Version History */}
        <TouchableOpacity testID="toggle-versions-btn" style={s.card} onPress={() => setShowVersions(!showVersions)}>
          <View style={s.versionHeader}>
            <Text style={s.cardTitle}>Version History ({versions.length})</Text>
            <Ionicons name={showVersions ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.muted} />
          </View>
          {showVersions && versions.length === 0 && (
            <Text style={s.noVersions}>No previous versions. This is the original document.</Text>
          )}
          {showVersions && versions.map(v => (
            <View key={v.id} testID={`version-${v.version}`} style={s.versionItem}>
              <View style={s.versionDot} />
              <View style={s.versionInfo}>
                <Text style={s.versionLabel}>Version {v.version}</Text>
                <Text style={s.versionMeta}>Changed: {v.changed_fields?.join(', ')}</Text>
                <Text style={s.versionMeta}>By: {v.changed_by_name} · {v.created_at?.slice(0, 10)}</Text>
                {v.change_reason && <Text style={s.versionReason}>{v.change_reason}</Text>}
              </View>
            </View>
          ))}
        </TouchableOpacity>

        {/* Metadata */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Metadata</Text>
          <DetailRow label="Document ID" value={doc.id?.slice(0, 12) + '...'} />
          <DetailRow label="Uploaded By" value={doc.uploader_name} />
          <DetailRow label="Invoice #" value={doc.extracted_data?.invoice_number} />
          <DetailRow label="Content Hash" value={doc.content_hash ? doc.content_hash.slice(0, 16) + '...' : 'N/A'} />
          <DetailRow label="Storage Path" value={doc.file_path} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.detailRow}><Text style={s.detailLabel}>{label}</Text><Text style={[s.detailValue, highlight && { color: colors.status.error }]} numberOfLines={1}>{value || '-'}</Text></View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: fonts.sizes.md, color: colors.text.muted },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full },
  statusText: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold },
  versionBadge: { backgroundColor: colors.background.overlay, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  versionText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.bold, color: colors.text.secondary },

  card: { backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border.default },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary, marginBottom: spacing.md },
  providerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand.secondary + '15', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  providerText: { fontSize: 10, color: colors.brand.secondary, fontWeight: fonts.weights.semibold },

  confBar: { height: 6, backgroundColor: colors.background.overlay, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.sm },
  confFill: { height: '100%', borderRadius: 3 },
  confValue: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold },
  methodText: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  detailLabel: { fontSize: fonts.sizes.sm, color: colors.text.muted },
  detailValue: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.medium, color: colors.text.primary, maxWidth: '60%', textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, marginTop: spacing.sm, borderTopWidth: 2, borderTopColor: colors.brand.primary + '40' },
  totalLabel: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.text.primary },
  totalValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.brand.primary },

  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  lineLeft: { flex: 1 },
  lineDesc: { fontSize: fonts.sizes.sm, color: colors.text.primary },
  lineMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  lineQty: { fontSize: fonts.sizes.xs, color: colors.text.muted },
  lineCategory: { fontSize: fonts.sizes.xs, color: colors.brand.primary + 'aa', backgroundColor: colors.brand.primary + '10', paddingHorizontal: 6, borderRadius: 4 },
  lineAmount: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary, marginLeft: spacing.md },

  ocrText: { fontSize: fonts.sizes.xs, color: colors.text.muted, fontFamily: 'monospace', lineHeight: 18 },

  versionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noVersions: { fontSize: fonts.sizes.sm, color: colors.text.muted, fontStyle: 'italic' },
  versionItem: { flexDirection: 'row', paddingVertical: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.brand.primary + '40', paddingLeft: spacing.lg, marginLeft: spacing.sm },
  versionDot: { position: 'absolute', left: -5, top: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.primary },
  versionInfo: { flex: 1 },
  versionLabel: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  versionMeta: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 1 },
  versionReason: { fontSize: fonts.sizes.xs, color: colors.text.secondary, fontStyle: 'italic', marginTop: 2 },
});
