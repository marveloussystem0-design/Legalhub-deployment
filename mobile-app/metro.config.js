// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude expo-router's internal temp server folders from Metro's file watcher.
// These folders contain server-side (web-only) packages like @radix-ui that
// hit the Metro server without a platform header, causing:
// "CommandError: Must specify expo-platform header or platform query parameter"
config.watchFolders = (config.watchFolders || []).filter(
  (folder) => !folder.includes('.expo-router-')
);

config.resolver.blockList = [
  ...(config.resolver.blockList ? [config.resolver.blockList].flat() : []),
  /node_modules[\\/]\.expo-router-.*/,
];

module.exports = config;
