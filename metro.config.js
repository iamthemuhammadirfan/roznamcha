// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// dotLottie animations (assets/animations/*.lottie) are zip files loaded as assets.
config.resolver.assetExts.push('lottie');

module.exports = config;
