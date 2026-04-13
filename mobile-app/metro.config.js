const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "..")

const config = getDefaultConfig(projectRoot)

// Watch only what mobile actually needs — not the entire monorepo.
// Including web-app makes Metro's FallbackWatcher crash on Vite's transient
// .vite/deps_temp_* files (ENOENT on watch) when watchman isn't installed.
config.watchFolders = [
  path.resolve(workspaceRoot, "packages"),
  path.resolve(workspaceRoot, "node_modules"),
]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
// Required for pnpm's symlinked node_modules to work with Metro
config.resolver.unstable_enableSymlinks = true

// Force react and react-native to always resolve from the workspace root's
// node_modules (the single hoisted copy), even when the requesting module
// lives somewhere else in the monorepo. This prevents duplicate React copies
// which cause "useContext" crashes.
const SINGLETONS = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-native"]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.includes(moduleName) || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(workspaceRoot, "node_modules", "react", "package.json") },
      moduleName,
      platform
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: "./global.css" })
