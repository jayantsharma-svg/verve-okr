// Set Expo Router app root before Metro initializes
process.env.EXPO_ROUTER_APP_ROOT = 'src/app'

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

module.exports = config
