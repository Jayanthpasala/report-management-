import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, radius, fonts } from '../utils/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (role: string) => {
    const emails: Record<string, string> = {
      owner: 'owner@spicekitchen.com',
      manager: 'manager@spicekitchen.com',
      staff: 'staff@spicekitchen.com',
      accounts: 'accounts@spicekitchen.com',
    };
    setEmail(emails[role]);
    setPassword('demo123');
    setLoading(true);
    setError('');
    try {
      await login(emails[role], 'demo123');
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={s.brandSection}>
          <View style={s.logoContainer}>
            <Ionicons name="analytics" size={40} color={colors.brand.primary} />
          </View>
          <Text style={s.brandName}>FinSight</Text>
          <Text style={s.brandTagline}>AI-Powered Financial Intelligence</Text>
        </View>

        {/* Login Form */}
        <View style={s.formCard}>
          <Text style={s.formTitle}>Sign In</Text>
          <Text style={s.formSubtitle}>Invite-only access for your organization</Text>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.status.error} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.inputGroup}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={colors.text.muted} style={s.inputIcon} />
              <TextInput
                testID="login-email-input"
                style={s.input}
                placeholder="your@email.com"
                placeholderTextColor={colors.text.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text.muted} style={s.inputIcon} />
              <TextInput
                testID="login-password-input"
                style={[s.input, { flex: 1 }]}
                placeholder="Enter password"
                placeholderTextColor={colors.text.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            testID="login-submit-button"
            style={[s.loginBtn, loading && s.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={s.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Login Demo */}
        <View style={s.demoSection}>
          <Text style={s.demoTitle}>Demo Access</Text>
          <View style={s.demoGrid}>
            {[
              { role: 'owner', icon: 'crown-outline' as const, label: 'Owner', color: colors.brand.primary },
              { role: 'manager', icon: 'business-outline' as const, label: 'Manager', color: colors.status.info },
              { role: 'staff', icon: 'person-outline' as const, label: 'Staff', color: colors.status.warning },
              { role: 'accounts', icon: 'calculator-outline' as const, label: 'Accounts', color: colors.brand.secondary },
            ].map((item) => (
              <TouchableOpacity
                key={item.role}
                testID={`demo-login-${item.role}`}
                style={[s.demoBtn, { borderColor: item.color + '40' }]}
                onPress={() => quickLogin(item.role)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={24} color={item.color} />
                <Text style={[s.demoBtnText, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl },
  brandSection: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoContainer: {
    width: 72, height: 72, borderRadius: radius.lg,
    backgroundColor: colors.brand.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  brandName: { fontSize: fonts.sizes.xxxl, fontWeight: fonts.weights.bold, color: colors.text.primary, letterSpacing: -1 },
  brandTagline: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },
  formCard: {
    backgroundColor: colors.background.surface, borderRadius: radius.xl,
    padding: spacing.xxl, borderWidth: 1, borderColor: colors.border.default,
  },
  formTitle: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, color: colors.text.primary },
  formSubtitle: { fontSize: fonts.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.status.error + '15', borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: colors.status.error, fontSize: fonts.sizes.sm, flex: 1 },
  inputGroup: { marginBottom: spacing.lg },
  label: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.medium, color: colors.text.secondary, marginBottom: spacing.sm },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background.default, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default, height: 52,
  },
  inputIcon: { marginLeft: spacing.lg },
  input: {
    flex: 1, color: colors.text.primary, fontSize: fonts.sizes.md,
    paddingHorizontal: spacing.md, height: '100%',
  },
  eyeBtn: { padding: spacing.md },
  loginBtn: {
    height: 52, borderRadius: radius.full, backgroundColor: colors.brand.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, color: colors.text.inverse },
  demoSection: { marginTop: spacing.xxxl, alignItems: 'center' },
  demoTitle: { fontSize: fonts.sizes.sm, color: colors.text.muted, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: 2 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  demoBtn: {
    width: 80, height: 80, borderRadius: radius.lg,
    backgroundColor: colors.background.surface, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  demoBtnText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
});
