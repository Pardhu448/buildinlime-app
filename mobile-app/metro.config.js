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
// Force singleton packages to always resolve from mobile-app's node_modules.
// Without this, Metro can pick up a second copy from the workspace root,
// causing "Cannot read property 'useContext' of null" crashes.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
}

// Force react and react-native to always resolve from mobile-app, even when
// the requesting module lives in the workspace root's node_modules (which has
// a different React version and causes "useContext(Context.Consumer)" crashes).
const SINGLETONS = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-native"]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.includes(moduleName) || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "package.json") },
      moduleName,
      platform
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: "./global.css" })
