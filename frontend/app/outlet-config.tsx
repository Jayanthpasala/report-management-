import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../utils/api';
import { colors, spacing, radius, fonts } from '../utils/theme';

function fmt(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const COUNTRY_MODES = [
  { id: 'india', label: '🇮🇳 India', desc: 'GST enabled, INR currency' },
  { id: 'international', label: '🌍 International', desc: 'Multi-currency support' },
];

const REPORT_TYPES = [
  { id: 'sales_receipt', label: 'Sales Receipt', icon: 'receipt-outline' },
  { id: 'purchase_invoice', label: 'Purchase Invoice', icon: 'cart-outline' },
  { id: 'expense_bill', label: 'Expense Bill', icon: 'cash-outline' },
  { id: 'aggregator_statement', label: 'Aggregator Statement', icon: 'phone-portrait-outline' },
];

export default function OutletConfigScreen() {
  const router = useRouter();
  const { outlet_id } = useLocalSearchParams<{ outlet_id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState<any>(null);
  
  // Editable fields
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [countryMode, setCountryMode] = useState('india');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState('18');
  const [requiredReports, setRequiredReports] = useState<string[]>(['sales_receipt', 'purchase_invoice']);
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessStart, setBusinessStart] = useState('09:00');
  const [businessEnd, setBusinessEnd] = useState('22:00');

  const fetchConfig = useCallback(async () => {
    if (!outlet_id) return;
    try {
      const data = await api.getOutletConfig(outlet_id);
      setConfig(data);
      
      // Populate form
      setName(data.name || '');
      setCity(data.city || '');
      setCountry(data.country || '');
      setCountryMode(data.country_mode || 'india');
      setCurrency(data.currency || 'INR');
      setTimezone(data.timezone || 'Asia/Kolkata');
      setGstEnabled(data.gst_enabled ?? true);
      setGstRate(String(data.gst_rate ? data.gst_rate * 100 : 18));
      setRequiredReports(data.required_daily_reports || ['sales_receipt', 'purchase_invoice']);
      setContactPhone(data.contact_phone || '');
      setAddress(data.address || '');
      setBusinessStart(data.business_hours_start || '09:00');
      setBusinessEnd(data.business_hours_end || '22:00');
    } catch (err) {
      console.error('Failed to fetch outlet config:', err);
      Alert.alert('Error', 'Failed to load outlet configuration');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outlet_id]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const toggleReportType = (type: string) => {
    setRequiredReports(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Outlet name is required');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: name.trim(),
        city: city.trim(),
        country: country.trim(),
        country_mode: countryMode,
        currency,
        timezone,
        gst_enabled: gstEnabled,
        gst_rate: parseFloat(gstRate) / 100,
        required_daily_reports: requiredReports,
        contact_phone: contactPhone.trim(),
        address: address.trim(),
        business_hours_start: businessStart,
        business_hours_end: businessEnd,
      };

      await api.updateOutletConfig(outlet_id!, updateData);
      Alert.alert('Success', 'Outlet configuration saved successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCountryModeChange = (mode: string) => {
    setCountryMode(mode);
    if (mode === 'india') {
      setCurrency('INR');
      setTimezone('Asia/Kolkata');
      setGstEnabled(true);
      setGstRate('18');
      setCountry('India');
    } else {
      // Keep current settings but enable international options
      setGstEnabled(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={s.loadingText}>Loading configuration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Outlet Configuration</Text>
            <Text style={s.subtitle}>{config?.name}</Text>
          </View>
          <TouchableOpacity 
            testID="save-config-btn"
            style={[s.saveBtn, saving && s.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <Ionicons name="checkmark" size={22} color={colors.text.inverse} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConfig(); }} tintColor={colors.brand.primary} />
          }
        >
          {/* Stats Summary */}
          {config?.stats && (
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Ionicons name="document-text" size={20} color={colors.brand.primary} />
                <Text style={s.statValue}>{config.stats.total_documents}</Text>
                <Text style={s.statLabel}>Documents</Text>
              </View>
              <View style={s.statCard}>
                <Ionicons name="alert-circle" size={20} color={colors.status.warning} />
                <Text style={[s.statValue, { color: colors.status.warning }]}>{config.stats.needs_review}</Text>
                <Text style={s.statLabel}>Need Review</Text>
              </View>
              <View style={s.statCard}>
                <Ionicons name="people" size={20} color={colors.status.info} />
                <Text style={s.statValue}>{config.stats.active_suppliers}</Text>
                <Text style={s.statLabel}>Suppliers</Text>
              </View>
              <View style={s.statCard}>
                <Ionicons name="trending-up" size={20} color={colors.brand.secondary} />
                <Text style={s.statValue}>{fmt(config.stats.monthly_spend)}</Text>
                <Text style={s.statLabel}>This Month</Text>
              </View>
            </View>
          )}

          {/* Country Mode Selection */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🌍 REGION MODE</Text>
            <Text style={s.sectionHint}>Select region to auto-configure tax and currency settings</Text>
            <View style={s.modeRow}>
              {COUNTRY_MODES.map(mode => (
                <TouchableOpacity
                  key={mode.id}
                  testID={`mode-${mode.id}`}
                  style={[s.modeCard, countryMode === mode.id && s.modeCardActive]}
                  onPress={() => handleCountryModeChange(mode.id)}
                >
                  <Text style={[s.modeLabel, countryMode === mode.id && s.modeLabelActive]}>{mode.label}</Text>
                  <Text style={s.modeDesc}>{mode.desc}</Text>
                  {countryMode === mode.id && (
                    <View style={s.modeCheck}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.brand.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Basic Info */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>📍 OUTLET DETAILS</Text>
            
            <Text style={s.label}>Outlet Name *</Text>
            <TextInput
              testID="outlet-name-input"
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Spice Kitchen - Koramangala"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={s.label}>City</Text>
            <TextInput
              testID="outlet-city-input"
              style={s.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Bangalore"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={s.label}>Country</Text>
            <TextInput
              testID="outlet-country-input"
              style={s.input}
              value={country}
              onChangeText={setCountry}
              placeholder="e.g. India"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={s.label}>Address</Text>
            <TextInput
              testID="outlet-address-input"
              style={[s.input, s.inputMultiline]}
              value={address}
              onChangeText={setAddress}
              placeholder="Full address for records"
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={2}
            />

            <Text style={s.label}>Contact Phone</Text>
            <TextInput
              testID="outlet-phone-input"
              style={s.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.text.muted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Currency & Timezone */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>💱 CURRENCY & TIME</Text>

            <Text style={s.label}>Local Currency</Text>
            <View style={s.pickerRow}>
              {(config?.available_currencies || ['INR', 'USD', 'AED', 'SGD', 'GBP']).slice(0, 5).map((cur: string) => (
                <TouchableOpacity
                  key={cur}
                  testID={`currency-${cur}`}
                  style={[s.pickerOption, currency === cur && s.pickerOptionActive]}
                  onPress={() => setCurrency(cur)}
                >
                  <Text style={[s.pickerText, currency === cur && s.pickerTextActive]}>{cur}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Timezone</Text>
            <View style={s.timezoneList}>
              {(config?.available_timezones || ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore']).map((tz: string) => (
                <TouchableOpacity
                  key={tz}
                  testID={`tz-${tz}`}
                  style={[s.tzOption, timezone === tz && s.tzOptionActive]}
                  onPress={() => setTimezone(tz)}
                >
                  <Text style={[s.tzText, timezone === tz && s.tzTextActive]}>{tz.replace('_', ' ')}</Text>
                  {timezone === tz && <Ionicons name="checkmark" size={16} color={colors.brand.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tax Settings */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🧾 TAX SETTINGS</Text>

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLabel}>GST/VAT Enabled</Text>
                <Text style={s.switchHint}>Enable tax tracking for this outlet</Text>
              </View>
              <Switch
                testID="gst-enabled-switch"
                value={gstEnabled}
                onValueChange={setGstEnabled}
                trackColor={{ false: colors.background.overlay, true: colors.brand.primary + '60' }}
                thumbColor={gstEnabled ? colors.brand.primary : colors.text.muted}
              />
            </View>

            {gstEnabled && (
              <>
                <Text style={s.label}>Tax Rate (%)</Text>
                <View style={s.pickerRow}>
                  {['5', '12', '18', '20', '28'].map(rate => (
                    <TouchableOpacity
                      key={rate}
                      testID={`rate-${rate}`}
                      style={[s.pickerOption, gstRate === rate && s.pickerOptionActive]}
                      onPress={() => setGstRate(rate)}
                    >
                      <Text style={[s.pickerText, gstRate === rate && s.pickerTextActive]}>{rate}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Required Daily Reports */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>📋 REQUIRED DAILY REPORTS</Text>
            <Text style={s.sectionHint}>Select report types required for compliance calendar</Text>

            {REPORT_TYPES.map(rt => (
              <TouchableOpacity
                key={rt.id}
                testID={`report-${rt.id}`}
                style={[s.reportRow, requiredReports.includes(rt.id) && s.reportRowActive]}
                onPress={() => toggleReportType(rt.id)}
              >
                <View style={[s.reportIcon, requiredReports.includes(rt.id) && s.reportIconActive]}>
                  <Ionicons name={rt.icon as any} size={20} color={requiredReports.includes(rt.id) ? colors.brand.primary : colors.text.muted} />
                </View>
                <Text style={[s.reportLabel, requiredReports.includes(rt.id) && s.reportLabelActive]}>{rt.label}</Text>
                <View style={[s.checkbox, requiredReports.includes(rt.id) && s.checkboxActive]}>
                  {requiredReports.includes(rt.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Business Hours */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🕐 BUSINESS HOURS</Text>

            <View style={s.hoursRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Opens At</Text>
                <TextInput
                  testID="hours-start-input"
                  style={s.input}
                  value={businessStart}
                  onChangeText={setBusinessStart}
                  placeholder="09:00"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
              <View style={s.hoursSpacer}>
                <Text style={s.hoursTo}>to</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Closes At</Text>
                <TextInput
                  testID="hours-end-input"
                  style={s.input}
                  value={businessEnd}
                  onChangeText={setBusinessEnd}
                  placeholder="22:00"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            testID="save-config-btn-bottom"
            style={[s.saveFullBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={colors.text.inverse} />
                <Text style={s.saveFullBtnText}>Save Configuration</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.lg, color: colors.text.muted, fontSize: fonts.sizes.md },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.background.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: fonts.sizes.xs, color: colors.text.secondary, marginTop: 1 },
  saveBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },

  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  statCard: { flex: 1, backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border.default },
  statValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold, color: colors.text.primary, marginTop: spacing.xs },
  statLabel: { fontSize: 10, color: colors.text.muted, marginTop: 2, textAlign: 'center' },

  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontSize: fonts.sizes.sm, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  sectionHint: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginBottom: spacing.md },

  modeRow: { flexDirection: 'row', gap: spacing.md },
  modeCard: { flex: 1, backgroundColor: colors.background.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border.default, position: 'relative' },
  modeCardActive: { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary + '10' },
  modeLabel: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold, color: colors.text.primary },
  modeLabelActive: { color: colors.brand.primary },
  modeDesc: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: spacing.xs },
  modeCheck: { position: 'absolute', top: spacing.sm, right: spacing.sm },

  label: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.lg, color: colors.text.primary, fontSize: fonts.sizes.md, borderWidth: 1, borderColor: colors.border.default },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  pickerRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pickerOption: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.background.surface, borderWidth: 1, borderColor: colors.border.default },
  pickerOptionActive: { backgroundColor: colors.brand.primary + '15', borderColor: colors.brand.primary },
  pickerText: { fontSize: fonts.sizes.md, color: colors.text.secondary, fontWeight: fonts.weights.medium },
  pickerTextActive: { color: colors.brand.primary },

  timezoneList: { gap: spacing.xs },
  tzOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default },
  tzOptionActive: { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary + '10' },
  tzText: { fontSize: fonts.sizes.md, color: colors.text.secondary },
  tzTextActive: { color: colors.brand.primary, fontWeight: fonts.weights.medium },

  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border.default },
  switchLabel: { fontSize: fonts.sizes.md, color: colors.text.primary, fontWeight: fonts.weights.medium },
  switchHint: { fontSize: fonts.sizes.xs, color: colors.text.muted, marginTop: 2 },

  reportRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border.default, gap: spacing.md },
  reportRowActive: { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary + '08' },
  reportIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.background.overlay, alignItems: 'center', justifyContent: 'center' },
  reportIconActive: { backgroundColor: colors.brand.primary + '20' },
  reportLabel: { flex: 1, fontSize: fonts.sizes.md, color: colors.text.secondary },
  reportLabelActive: { color: colors.text.primary, fontWeight: fonts.weights.medium },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border.light, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },

  hoursRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  hoursSpacer: { paddingBottom: spacing.lg },
  hoursTo: { fontSize: fonts.sizes.md, color: colors.text.muted },

  saveFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brand.primary, borderRadius: radius.full, height: 52, marginTop: spacing.lg },
  saveFullBtnText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, color: colors.text.inverse },
});
