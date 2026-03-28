import Constants from 'expo-constants';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

export function getWebBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();

  if (__DEV__) {
    if (envUrl && !envUrl.includes('localhost')) {
      return stripTrailingSlash(envUrl);
    }

    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      return `http://${ip}:3000`;
    }
  }

  if (envUrl) {
    return stripTrailingSlash(envUrl);
  }

  // Production-safe default domain fallback.
  return 'https://legalhub.digitalmeng.com';
}
