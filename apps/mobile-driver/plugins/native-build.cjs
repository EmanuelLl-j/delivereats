const { withProjectBuildGradle } = require('expo/config-plugins');

// Android's default CMake 3.22.1 bundles an old Ninja with Windows path limits.
// Keep this in a config plugin so Expo prebuild preserves the fix.
const marker = '// DeliverEats: Windows native build tools';
const block = `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  subprojects { nativeProject ->
    ['com.android.application', 'com.android.library'].each { pluginId ->
      nativeProject.pluginManager.withPlugin(pluginId) {
        nativeProject.extensions.getByName('android').externalNativeBuild.cmake.version = '3.31.6'
      }
    }
  }
}
`;
module.exports = config => withProjectBuildGradle(config, result => {
  if (result.modResults.language !== 'groovy') throw new Error('DeliverEats requiere build.gradle Groovy');
  const start = result.modResults.contents.indexOf(marker);
  if (start !== -1) {
    const end = result.modResults.contents.indexOf('\n}\n', start);
    if (end === -1) throw new Error('Bloque de compilación nativa incompleto');
    result.modResults.contents = result.modResults.contents.slice(0, start) + result.modResults.contents.slice(end + 3);
  }
  const anchor = 'apply plugin: "expo-root-project"';
  if (!result.modResults.contents.includes(anchor)) throw new Error('No se encontró expo-root-project');
  result.modResults.contents = result.modResults.contents.replace(anchor, block + '\n' + anchor);
  return result;
});
