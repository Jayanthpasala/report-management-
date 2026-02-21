import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { uploadQueue, QueuedUpload } from '../../utils/uploadQueue';
import { colors, spacing, radius, fonts } from '../../utils/theme';

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: 'time-outline', color: colors.status.warning, label: 'Queued' },
  uploading: { icon: 'cloud-upload-outline', color: colors.status.info, label: 'Uploading...' },
  success: { icon: 'checkmark-circle', color: colors.brand.primary, label: 'Done' },
  failed: { icon: 'alert-circle', color: colors.status.error, label: 'Failed' },
  duplicate: { icon: 'copy-outline', color: colors.text.muted, label: 'Duplicate' },
};

export default function UploadScreen() {
  const { user, outlets } = useAuth();
  const [selectedOutlet, setSelectedOutlet] = useState(user?.outlet_ids?.[0] || '');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showOutletPicker, setShowOutletPicker] = useState(false);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);

  const outletName = outlets.find((o: any) => o.id === selectedOutlet)?.name || 'Select Outlet';
  const isStaff = user?.role === 'staff';

  useEffect(() => {
    uploadQueue.getQueue().then(setQueue);
    const unsub = uploadQueue.subscribe(setQueue);
    return unsub;
  }, []);

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take photos');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) uploadFile(res.assets[0]);
  };

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Gallery access is required');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) uploadFile(res.assets[0]);
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (!res.canceled && res.assets?.[0]) uploadFile(res.assets[0]);
  };

  const uploadFile = async (asset: any) => {
    if (!selectedOutlet) {
      Alert.alert('Select Outlet', 'Please select an outlet first');
      return;
    }

    // Add to queue (handles duplicate detection + offline)
    const fileName = asset.fileName || asset.name || 'document.jpg';
    const mimeType = asset.mimeType || 'image/jpeg';
    await uploadQueue.addToQueue(asset.uri, fileName, mimeType, selectedOutlet);

    // Also try direct upload for immediate feedback
    setUploading(true);
    setResult(null);
    try {
      const file = { uri: asset.uri, name: fileName, type: mimeType } as any;
      const res = await api.uploadDocument(file, selectedOutlet);
      setResult(res);
    } catch (err: any) {
      // Upload queued for retry
      Alert.alert('Queued', 'Upload queued and will retry when connection is available.');
    } finally {
      setUploading(false);
    }
  };

  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'uploading').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>{isStaff ? 'Upload Bill' : 'Upload Document'}</Text>
            {!isStaff && <Text style={s.subtitle}>Upload invoices, bills, or statements</Text>}
          </View>
          {/* AI Provider Badge */}
          <View style={s.aiBadge}>
            <Ionicons name="sparkles" size={12} color={colors.brand.secondary} />
            <Text style={s.aiBadgeText}>GPT-4o</Text>
          </View>
        </View>

        {/* Queue Status Bar */}
        {(pendingCount > 0 || failedCount > 0) && (
          <View testID="upload-queue-status" style={s.queueBar}>
            {pendingCount > 0 && (
              <View style={s.queueChip}>
                <ActivityIndicator size="small" color={colors.status.info} />
                <Text style={s.queueChipText}>{pendingCount} uploading</Text>
              </View>
            )}
            {failedCount > 0 && (
              <TouchableOpacity style={[s.queueChip, { backgroundColor: colors.status.error + '15' }]} onPress={() => uploadQueue.trySync()}>
                <Ionicons name="refresh" size={14} color={colors.status.error} />
                <Text style={[s.queueChipText, { color: colors.status.error }]}>{failedCount} failed · Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Outlet Selector */}
        {outlets.length > 1 && (
          <TouchableOpacity testID="outlet-selector" style={s.outletSelector} onPress={() => setShowOutletPicker(!showOutletPicker)}>
            <Ionicons name="business-outline" size={20} color={colors.text.secondary} />
            <Text style={s.outletSelectorText} numberOfLines={1}>{outletName}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        )}

        {showOutletPicker && (
          <View style={s.outletDropdown}>
            {outlets.map((o: any) => (
              <TouchableOpacity
                key={o.id}
                style={[s.outletOption, o.id === selectedOutlet && s.outletOptionActive]}
                onPress={() => { setSelectedOutlet(o.id); setShowOutletPicker(false); }}
              >
                <Text style={[s.outletOptionText, o.id === selectedOutlet && s.outletOptionTextActive]}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {uploading ? (
          <View style={s.uploadingContainer}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={s.uploadingText}>AI is analyzing your document...</Text>
            <Text style={s.uploadingSubtext}>GPT-4o extracting data with vision</Text>
          </View>
        ) : result ? (
          <View style={s.resultContainer}>
            <View style={[s.resultIcon, { backgroundColor: result.ai_summary?.requires_review ? colors.status.warning + '20' : colors.brand.primary + '20' }]}>
              <Ionicons
                name={result.ai_summary?.requires_review ? 'alert-circle' : 'checkmark-circle'}
                size={48}
                color={result.ai_summary?.requires_review ? colors.status.warning : colors.brand.primary}
              />
            </View>
            <Text style={s.resultTitle}>{result.duplicate ? 'Duplicate Detected' : result.ai_summary?.requires_review ? 'Needs Review' : 'Processed!'}</Text>
            {!result.duplicate && (
              <>
                <Text style={s.resultSubtitle}>{result.document?.original_filename}</Text>
                <View style={s.aiProviderRow}>
                  <Ionicons name="sparkles" size={14} color={colors.brand.secondary} />
                  <Text style={s.aiProviderText}>Analyzed by {result.ai_summary?.provider || 'AI'} · {result.ai_summary?.retries_used || 0} retries</Text>
                </View>
                <View style={s.resultDetails}>
                  <ResultRow label="Confidence" value={`${(result.ai_summary?.confidence * 100).toFixed(0)}%`} />
                  <ResultRow label="Supplier" value={result.document?.supplier_name} />
                  <ResultRow label="Amount" value={`₹${result.document?.extracted_data?.total_amount?.toLocaleString()}`} />
                  <ResultRow label="Date" value={result.document?.document_date || 'Not detected'} />
                  <ResultRow label="Type" value={result.document?.document_type?.replace(/_/g, ' ')} />
                  <ResultRow label="AI Provider" value={result.document?.ai_provider_used || 'N/A'} />
                  <ResultRow label="Version" value={`v${result.document?.version_number || 1}`} />
                </View>
              </>
            )}
            <TouchableOpacity testID="upload-another-btn" style={s.uploadAnotherBtn} onPress={() => setResult(null)}>
              <Ionicons name="add-circle" size={20} color={colors.text.inverse} />
              <Text style={s.uploadAnotherText}>Upload Another</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.uploadOptions}>
            <TouchableOpacity testID="camera-upload-btn" style={s.cameraBtn} onPress={pickCamera} activeOpacity={0.8}>
              <Ionicons name="camera" size={isStaff ? 72 : 48} color={colors.text.inverse} />
              <Text style={s.cameraBtnText}>Take Photo</Text>
            </TouchableOpacity>
            {!isStaff && (
              <View style={s.secondaryOptions}>
                <TouchableOpacity testID="gallery-upload-btn" style={s.secondaryBtn} onPress={pickGallery} activeOpacity={0.7}>
                  <Ionicons name="images-outline" size={28} color={colors.brand.primary} />
                  <Text style={s.secondaryBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="pdf-upload-btn" style={s.secondaryBtn} onPress={pickDocument} activeOpacity={0.7}>
                  <Ionicons name="document-outline" size={28} color={colors.brand.secondary} />
                  <Text style={s.secondaryBtnText}>PDF / File</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={s.supportedTypes}>
              <Text style={s.supportedTitle}>Supported formats</Text>
              <Text style={s.supportedText}>JPG, PNG, HEIC, PDF · Multi-page · Max 10MB</Text>
              <Text style={s.supportedText}>Works offline · Auto-retry on failure</Text>
            </View>
          </View>
        )}

        {/* Recent Queue Items */}
        {queue.length > 0 && (
          <View style={s.queueSection}>
            <View style={s.queueHeader}>
              <Text style={s.queueTitle}>Upload Queue ({queue.length})</Text>
              <TouchableOpacity testID="clear-queue-btn" onPress={() => uploadQueue.clearCompleted()}>
                <Text style={s.clearText}>Clear Done</Text>
              </TouchableOpacity>
            </View>
            {queue.slice(0, 10).map(item => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              return (
                <View key={item.id} testID={`queue-item-${item.id}`} style={s.queueItem}>
                  <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                  <View style={s.queueItemInfo}>
                    <Text style={s.queueItemName} numberOfLines={1}>{item.fileName}</Text>
                    <Text style={[s.queueItemStatus, { color: cfg.color }]}>{cfg.label}{item.retries > 0 ? ` (retry ${item.retries})` : ''}</Text>
                  </View>
                  {item.status === 'failed' && (
                    <TouchableOpacity onPress={() => uploadQueue.retryItem(item.id)} style={s.retryBtn}>
                      <Ionicons name="refresh" size={16} color={colors.brand.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.resultRow}><Text style={s.resultLabel}>{label}</Text><Text style={s.resultValue}>{value}</Text></View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  title: { fontSize: fonts.sizes.xxl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand.secondary + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  aiBadgeText: { fontSize: fonts.sizes.xs, color: colors.brand.secondary, fontWeight: fonts.weights.semibold },

  // Queue Status
  queueBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  queueChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.status.info + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  queueChipText: { fontSize: fonts.sizes.xs, color: colors.status.info, fontWeight: fonts.weights.medium },

  // Outlet
  outletSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.default },
  outletSelectorText: { flex: 1, fontSize: fonts.sizes.md, color: colors.text.primary },
  outletDropdown: { backgroundColor: colors.background.surface, borderRadius: radius.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border.default, overflow: 'hidden' },
  outletOption: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  outletOptionActive: { backgroundColor: colors.brand.primary + '15' },
  outletOptionText: { fontSize: fonts.sizes.md, color: colors.text.secondary },
  outletOptionTextActive: { color: colors.brand.primary, fontWeight: fonts.weights.semibold },

  // Upload
  uploadOptions: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxxl },
  cameraBtn: { width: 200, height: 200, borderRadius: radius.xl, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  cameraBtnText: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.inverse, marginTop: spacing.sm },
  secondaryOptions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xxxl },
  secondaryBtn: { width: 100, height: 100, borderRadius: radius.lg, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.default, gap: spacing.sm },
  secondaryBtnText: { fontSize: fonts.sizes.sm, color: colors.text.secondary, fontWeight: fonts.weights.medium },
  supportedTypes: { marginTop: spacing.xxxl, alignItems: 'center', gap: 4 },
  supportedTitle: { fontSize: fonts.sizes.xs, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1 },
  supportedText: { fontSize: fonts.sizes.xs, color: colors.text.muted },

  // Uploading
  uploadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  uploadingText: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, color: colors.text.primary, marginTop: spacing.xl },
  uploadingSubtext: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },

  // Result
  resultContainer: { alignItems: 'center', paddingVertical: spacing.xxl },
  resultIcon: { width: 80, height: 80, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  resultTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  resultSubtitle: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },
  aiProviderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  aiProviderText: { fontSize: fonts.sizes.xs, color: colors.brand.secondary },
  resultDetails: { width: '100%', backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border.default },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  resultLabel: { fontSize: fonts.sizes.sm, color: colors.text.muted },
  resultValue: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  uploadAnotherBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brand.primary, borderRadius: radius.full, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, marginTop: spacing.xxl },
  uploadAnotherText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.inverse },

  // Queue Section
  queueSection: { marginTop: spacing.xxl },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  queueTitle: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  clearText: { fontSize: fonts.sizes.sm, color: colors.brand.primary },
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border.default },
  queueItemInfo: { flex: 1 },
  queueItemName: { fontSize: fonts.sizes.sm, color: colors.text.primary },
  queueItemStatus: { fontSize: fonts.sizes.xs, marginTop: 1 },
  retryBtn: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.brand.primary + '15', alignItems: 'center', justifyContent: 'center' },
});
