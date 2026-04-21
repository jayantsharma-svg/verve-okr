module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // Path aliases (@/*) are handled via tsconfig.json + metro.config.js
    // — no babel-plugin-module-resolver needed for Expo SDK 51+
  }
}
