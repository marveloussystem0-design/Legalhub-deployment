import 'react-native-get-random-values';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "../constants/Colors";
import { AuthProvider } from "../lib/auth-context";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
  SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    // Ignore specific warnings
    const { LogBox } = require("react-native");
    LogBox.ignoreLogs([
      "ProgressBarAndroid has been extracted",
      "expo-notifications functionality is not fully supported", 
    ]);

    if (loaded) {
      SplashScreen.hideAsync();

      // Push notification registration is now handled in AuthContext 
      // to ensure we have a valid user ID for database syncing.
      // (Logic moved to ensure strict ordering with auth state)

      // Listen for notification interactions
      const subscription =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;

          // Use the role-aware deep-link stored in metadata if available
          if (data.link && typeof data.link === 'string') {
            // Internal mobile routes start with /cases/
            if (data.link.startsWith('/cases/')) {
              router.push(data.link as any);
            }
            // Otherwise it's a web dashboard link — navigate to the case in-app
            else if (data.case_id) {
              router.push(`/cases/${data.case_id}` as any);
            }
          } else if (data.caseId) {
            router.push(`/cases/${data.caseId}` as any);
          } else if (data.type === 'admin_broadcast') {
            router.push('/(tabs)');
          }
        });

      return () => {
        subscription.remove();
      };
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // Custom Dark Theme matching our Web App
  const CustomDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Colors.dark.background,
      card: Colors.dark.surface,
      text: Colors.dark.text,
      primary: Colors.dark.tint,
      border: Colors.dark.border,
    },
  };

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? CustomDarkTheme : DefaultTheme}
    >
      <AuthProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="terms/index" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
