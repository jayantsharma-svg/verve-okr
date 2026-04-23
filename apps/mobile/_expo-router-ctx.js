// Custom Expo Router context file with a static app directory path.
// This replaces expo-router/_ctx so that require.context gets a string literal
// instead of process.env.EXPO_ROUTER_APP_ROOT (which fails on EAS Build cloud workers).
export const ctx = require.context(
  './app',
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.ios|\.web)?\.[tj]sx?$/
);
