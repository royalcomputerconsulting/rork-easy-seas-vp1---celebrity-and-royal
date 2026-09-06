// Keep the native bundle root inside the project even when node_modules lives
// on the external development volume. Expo Router still owns registration and
// route discovery; this file only prevents Xcode from embedding an external
// absolute path as Metro's entry point.
import 'expo-router/entry';
