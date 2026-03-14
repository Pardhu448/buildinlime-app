const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "..")

const config = getDefaultConfig(projectRoot)

// Let Metro watch the monorepo root and resolve packages from both locations
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
// Required for pnpm's symlinked node_modules to work with Metro
config.resolver.unstable_enableSymlinks = true

module.exports = withNativeWind(config, { input: "./global.css" })
