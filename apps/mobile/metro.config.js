const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

// Turborepo monorepo support: make workspace packages (e.g. @simbridge/shared,
// @simbridge/crypto) resolvable and watched by Metro.
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

const nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// bun workspaces keep each package's deps in its own node_modules (no hoist),
// so include those dirs too, e.g. @simbridge/crypto's tweetnacl.
for (const scope of ["apps", "packages"]) {
  const scopeDir = path.join(monorepoRoot, scope);
  if (!fs.existsSync(scopeDir)) continue;
  for (const entry of fs.readdirSync(scopeDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const nm = path.join(scopeDir, entry.name, "node_modules");
    if (fs.existsSync(nm)) nodeModulesPaths.push(nm);
  }
}

config.resolver.nodeModulesPaths = nodeModulesPaths;

module.exports = config;
