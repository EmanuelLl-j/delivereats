// Gradle passes an app-relative entry during native embedding. Keep Metro's
// server root aligned; normal development/web builds retain workspace discovery.
if (process.argv.includes('export:embed')) process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (process.argv.includes('export:embed')) {
  config.watchFolders = [require('node:path').resolve(__dirname, '../..')];
}
// Keep local native bundling within the workstation's memory budget.
config.maxWorkers = 2;
module.exports = config;
