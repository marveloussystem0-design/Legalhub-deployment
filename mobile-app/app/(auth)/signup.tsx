import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { Scale, Mail, Lock, Eye, EyeOff, ArrowRight, User, Briefcase, Users, Phone } from 'lucide-react-native';
import { Link, router } from 'expo-router';

import TermsModal from '@/components/TermsModal';

type UserRole = 'advocate' | 'client';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('advocate');
  
  // New Profile Fields
  const [barCouncilNumber, setBarCouncilNumber] = useState('');
  const [barCouncilState, setBarCouncilState] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [specialization, setSpecialization] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const SPECIALIZATIONS = [
    { label: 'Criminal Law', value: 'criminal' },
    { label: 'Civil Law', value: 'civil' },
    { label: 'Family Law', value: 'family' },
    { label: 'Corporate Law', value: 'corporate' },
    { label: 'Property Law', value: 'property' },
    { label: 'Tax Law', value: 'tax' },
    { label: 'Immigration', value: 'immigration' },
    { label: 'Intellectual Property', value: 'ipr' },
    { label: 'Consumer Protection', value: 'consumer' }
  ];

  async function signUpWithEmail() {
    if (!name || !email || !phone || !password || !confirmPassword) {
      alert('Please fill in all basic fields');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          phone: phone.trim(),
          role: role,
          // Pass all profile fields to metadata
          bar_council_number: barCouncilNumber,
          bar_council_state: barCouncilState,
          experience_years: experienceYears ? parseInt(experienceYears) : null,
          specialization: specialization,
          bio: bio,
          address: address,
          city: city,
          state: state,
          pincode: pincode,
        }
      }
    });

    if (error) {
      alert('Sign Up Failed: ' + error.message);
    } else {
      alert('Account created! Please check your email to verify your account.');
      router.replace('/(auth)/login');
    }
    setLoading(false);
  }

  const toggleSpecialization = (value: string) => {
    setSpecialization(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value) 
        : [...prev, value]
    );
  };

  const RoleCard = ({ value, label, icon: Icon, description }: { value: UserRole, label: string, icon: any, description: string }) => (
    <TouchableOpacity
      style={[
        styles.roleCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
        role === value && { borderColor: theme.tint, backgroundColor: theme.tint + '10' }
      ]}
      onPress={() => setRole(value)}
    >
      <View style={styles.roleHeader}>
        <Icon size={24} color={role === value ? theme.tint : theme.icon} />
        <Text style={[styles.roleLabel, { color: theme.icon }, role === value && { color: theme.tint }]}>{label}</Text>
      </View>
      <Text style={[styles.roleDescription, { color: theme.icon }]}>{description}</Text>
    </TouchableOpacity>
  );

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
          <View style={[styles.iconCircle, { borderColor: theme.tint + '4D', backgroundColor: theme.tint + '26' }]}>
            <Scale size={56} color={theme.tint} strokeWidth={2} />
          </View>
          <Text style={[styles.appName, { color: theme.tint }]}>LEGALHUB</Text>
          <Text style={[styles.tagline, { color: theme.icon }]}>Your Legal Companion</Text>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeTitle, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.welcomeSubtitle, { color: theme.icon }]}>Sign up to get started with your legal journey</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          
          {/* Role Selection */}
          <View>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Select Role</Text>
            <View style={styles.roleContainer}>
              <RoleCard 
                value="advocate" 
                label="Advocate" 
                icon={Briefcase} 
                description="Legal professional"
              />
              <RoleCard 
                value="client" 
                label="Litigant" 
                icon={Users} 
                description="Seeking assistance"
              />
            </View>
          </View>

          {/* Name Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
            <View style={[
                styles.inputContainer, 
                { backgroundColor: theme.surface, borderColor: theme.border },
                name ? { borderColor: theme.tint, borderWidth: 2 } : {}
            ]}>
              <User size={22} color={name ? theme.tint : theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your full name"
                placeholderTextColor={theme.icon}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
            <View style={[
                styles.inputContainer,
                { backgroundColor: theme.surface, borderColor: theme.border },
                email ? { borderColor: theme.tint, borderWidth: 2 } : {}
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

          {/* Phone Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
            <View style={[
                styles.inputContainer,
                { backgroundColor: theme.surface, borderColor: theme.border },
                phone ? { borderColor: theme.tint, borderWidth: 2 } : {}
            ]}>
              <Phone size={22} color={phone ? theme.tint : theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your phone number"
                placeholderTextColor={theme.icon}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Role-Specific Fields */}
          {role === 'advocate' ? (
            <View style={{ gap: 20 }}>
               <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Bar Council Number</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. D/123/2024"
                    placeholderTextColor={theme.icon}
                    value={barCouncilNumber}
                    onChangeText={setBarCouncilNumber}
                  />
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Bar Council State</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. Maharashtra"
                    placeholderTextColor={theme.icon}
                    value={barCouncilState}
                    onChangeText={setBarCouncilState}
                  />
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Years of Experience</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. 10"
                    placeholderTextColor={theme.icon}
                    keyboardType="numeric"
                    value={experienceYears}
                    onChangeText={setExperienceYears}
                  />
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Specialization Areas</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {SPECIALIZATIONS.map((spec) => (
                    <TouchableOpacity
                      key={spec.value}
                      onPress={() => toggleSpecialization(spec.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: specialization.includes(spec.value) ? theme.tint : theme.border,
                        backgroundColor: specialization.includes(spec.value) ? theme.tint + '10' : theme.surface,
                      }}
                    >
                      <Text style={{ 
                        fontSize: 12, 
                        color: specialization.includes(spec.value) ? theme.tint : theme.icon,
                        fontWeight: specialization.includes(spec.value) ? '600' : '400'
                      }}>
                        {spec.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Bio</Text>
                <View style={[styles.inputContainer, { height: 100, paddingVertical: 10, backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text, textAlignVertical: 'top' }]}
                    placeholder="Tell us about yourself"
                    placeholderTextColor={theme.icon}
                    multiline
                    numberOfLines={4}
                    value={bio}
                    onChangeText={setBio}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
               <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>City</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter city"
                    placeholderTextColor={theme.icon}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>State & Pincode</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.inputContainer, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="State"
                      placeholderTextColor={theme.icon}
                      value={state}
                      onChangeText={setState}
                    />
                  </View>
                  <View style={[styles.inputContainer, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Pincode"
                      placeholderTextColor={theme.icon}
                      value={pincode}
                      onChangeText={setPincode}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Full Address</Text>
                <View style={[styles.inputContainer, { height: 80, paddingVertical: 10, backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text, textAlignVertical: 'top' }]}
                    placeholder="Enter your address"
                    placeholderTextColor={theme.icon}
                    multiline
                    numberOfLines={3}
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
            <View style={[
                styles.inputContainer,
                { backgroundColor: theme.surface, borderColor: theme.border },
                password ? { borderColor: theme.tint, borderWidth: 2 } : {}
            ]}>
              <Lock size={22} color={password ? theme.tint : theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Create a password"
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

          {/* Confirm Password Input */}
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Confirm Password</Text>
            <View style={[
                styles.inputContainer,
                { backgroundColor: theme.surface, borderColor: theme.border },
                confirmPassword ? { borderColor: theme.tint, borderWidth: 2 } : {}
            ]}>
              <Lock size={22} color={confirmPassword ? theme.tint : theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.icon}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                {showConfirmPassword ? (
                  <EyeOff size={22} color={theme.icon} />
                ) : (
                  <Eye size={22} color={theme.icon} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.tint }, loading && styles.buttonDisabled]} 
            onPress={signUpWithEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Create Account</Text>
                <ArrowRight size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: theme.icon, fontSize: 12 }}>By joining, you agree to our </Text>
            <TouchableOpacity onPress={() => setShowTerms(true)}>
                <Text style={{ color: theme.tint, fontSize: 12, fontWeight: '600' }}>Terms of Service</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.signupText, { color: theme.icon }]}>
            Already have an account?{' '}
            <Link href="/(auth)/login" asChild>
              <Text style={[styles.signupLink, { color: theme.tint }]}>Sign In</Text>
            </Link>
          </Text>
        </View>

      </ScrollView>

      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} />
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
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingBottom: 4,
  },
  roleCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    width: 140,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    height: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
});
