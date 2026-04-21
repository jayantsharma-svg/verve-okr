/**
 * Shim for react-native/Libraries/Utilities/DevLoadingView
 * This module was removed/renamed in React Native 0.74 but is still referenced
 * by expo 55's HMR utilities. Since it's dev-only (HMR loading indicator),
 * a no-op implementation is safe.
 */
const DevLoadingView = {
  showMessage: (_message, _type) => {},
  hide: () => {},
};

module.exports = DevLoadingView;
module.exports.default = DevLoadingView;
