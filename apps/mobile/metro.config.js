// Expo's default Metro config already understands pnpm workspaces (watch folders,
// node_modules resolution across the monorepo root). Kept explicit for future tweaks.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
