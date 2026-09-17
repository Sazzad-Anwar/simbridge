const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Turborepo monorepo support: make workspace packages (e.g. @simbridge/shared,
// @simbridge/crypto) resolvable and watched by Metro.
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
