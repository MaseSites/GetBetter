// Metro im Monorepo: der Kern liegt ausserhalb des App-Ordners und muss
// deshalb mitbeobachtet werden.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Kein `disableHierarchicalLookup`: Expo loest einige Pakete (z. B. expo-asset)
// ueber die eigene Aufloesung, die dabei ausfaellt.

module.exports = config;
