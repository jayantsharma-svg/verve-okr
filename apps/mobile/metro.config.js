const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// ─── Monorepo: watch everything from the workspace root ───────────────────────
config.watchFolders = [workspaceRoot]

// ─── Resolve modules from both the app and the workspace root ─────────────────
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  // expo nests some packages (e.g. @expo/vector-icons) inside its own node_modules
  path.resolve(projectRoot, 'node_modules/expo/node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// ─── Ensure symlinked workspace packages are followed ─────────────────────────
config.resolver.disableHierarchicalLookup = false

// ─── Fix: EXPO_ROUTER_APP_ROOT not inlined in EAS Build cloud workers ─────────
// expo-router's _ctx.js uses `require.context(process.env.EXPO_ROUTER_APP_ROOT, ...)`
// which requires a static string. We redirect to a local file with a hardcoded path.
const customCtxPath = path.resolve(projectRoot, '_expo-router-ctx.js')
const originalResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-router/_ctx') {
    return { filePath: customCtxPath, type: 'sourceFile' }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
