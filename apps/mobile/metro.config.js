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

// ─── Custom resolver fixes ────────────────────────────────────────────────────
const customCtxPath = path.resolve(projectRoot, '_expo-router-ctx.js')
const coreSourceRoot = path.resolve(workspaceRoot, 'packages/core/src')
const originalResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix 1: EXPO_ROUTER_APP_ROOT not inlined in EAS Build cloud workers.
  // expo-router/_ctx uses require.context(process.env.EXPO_ROUTER_APP_ROOT, ...)
  // which requires a static string. Redirect to a local file with a hardcoded path.
  if (moduleName === 'expo-router/_ctx') {
    return { filePath: customCtxPath, type: 'sourceFile' }
  }

  // Fix 2: @okr-tool/core dist/ doesn't exist on EAS Build server (not pre-built).
  // Redirect Metro directly to the TypeScript source entry point.
  if (moduleName === '@okr-tool/core') {
    return {
      filePath: path.join(coreSourceRoot, 'index.ts'),
      type: 'sourceFile',
    }
  }

  // Fix 3: Files inside packages/core/src use NodeNext-style .js extensions
  // in their import paths (e.g. './types/index.js'), but only .ts files exist.
  // Strip the .js extension and try .ts so Metro can find them.
  const origin = context.originModulePath ?? ''
  if (
    origin.includes('/packages/core/src/') &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js')
  ) {
    const tsModule = moduleName.slice(0, -'.js'.length) + '.ts'
    try {
      return context.resolveRequest(context, tsModule, platform)
    } catch (_) {
      // Not found as .ts either — fall through to default resolution below
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
