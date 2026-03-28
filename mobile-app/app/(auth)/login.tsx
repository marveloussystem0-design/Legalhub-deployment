import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { Scale, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { Link } from 'expo-router';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function signInWithEmail() {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      alert('Please enter your email address first');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'legalhub://reset-password',
    });

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Password reset email sent! Please check your inbox.');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { 
            backgroundColor: `${theme.tint}20`,
            borderColor: `${theme.tint}40`
          }]}>
            <Scale size={56} color={theme.tint} strokeWidth={2} />
          </View>
          <Text style={[styles.appName, { color: theme.tint }]}>LEGALHUB</Text>
          <Text style={[styles.tagline, { color: theme.icon }]}>Your Legal Companion</Text>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeTitle, { color: theme.text }]}>Welcome Back</Text>
          <Text style={[styles.welcomeSubtitle, { color: theme.icon }]}>Sign in to continue to your account</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
            <View style={[
              styles.inputContainer, 
              { backgroundColor: theme.surface, borderColor: theme.border },
              email && { borderColor: theme.tint, borderWidth: 2 }
            ]}>
              <Mail size={22} color={email ? theme.tint : theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.icon}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
            <View style={[
              styles.inputContainer,
              { backgroundColor: theme.surface, borderColor: theme.border },
              password && { borderColor: theme.tint, borderWidth: 2 }
            ]}>
              <Lock size={22} color={password ? theme.tint : theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.icon}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                {showPassword ? (
                  <EyeOff size={22} color={theme.icon} />
                ) : (
                  <Eye size={22} color={theme.icon} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]} 
            onPress={signInWithEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Sign In</Text>
                <ArrowRight size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: theme.tint }]}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.icon }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <Text style={[styles.signupText, { color: theme.icon }]}>
            Don't have an account?{' '}
            <Link href="/(auth)/signup" asChild>
              <Text style={[styles.signupLink, { color: theme.tint }]}>Sign Up</Text>
            </Link>
          </Text>
          <DebugConfig />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 15,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  formContainer: {
    gap: 20,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 60,
    paddingHorizontal: 18,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    height: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 40,
    gap: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signupText: {
    textAlign: 'center',
    fontSize: 15,
  },
  signupLink: {
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
});

const DebugConfig = () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'MISSING';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'MISSING';
  const keyPrefix = key !== 'MISSING' ? key.substring(0, 10) + '...' : 'INVALID';
  
  if (!__DEV__) return null;

  return (
    <View style={{ padding: 10, marginTop: 20, opacity: 0.5, borderTopWidth: 1, borderTopColor: '#333' }}>
      <Text style={{ color: 'gray', fontSize: 10 }}>Debug Info:</Text>
      <Text style={{ color: 'gray', fontSize: 10 }}>URL: {url}</Text>
      <Text style={{ color: 'gray', fontSize: 10 }}>Key: {keyPrefix}</Text>
    </View>
  );
};
