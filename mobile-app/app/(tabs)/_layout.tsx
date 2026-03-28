import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Chrome as Home, Briefcase, MessageSquare, Sparkles, User, Gavel } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();

  const ProfileButton = () => (
    <TouchableOpacity
      onPress={() => {
        console.log('🔘 Profile button clicked');
        console.log('Current user:', user?.email);
        console.log('Attempting navigation to: /(tabs)/profile');
        try {
          router.push('/(tabs)/profile');
          console.log('✅ Navigation triggered successfully');
        } catch (error) {
          console.error('❌ Navigation error:', error);
        }
      }}
      style={styles.profileButton}
    >
      <View style={[styles.profileCircle, { borderColor: theme.tint }]}>
        <User size={20} color={theme.tint} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          color: theme.text,
          fontSize: 20,
          fontWeight: 'bold',
        },
        headerRight: () => <ProfileButton />,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'Cases',
          tabBarIcon: ({ color }) => <Gavel size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileButton: {
    marginRight: 16,
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },
});
