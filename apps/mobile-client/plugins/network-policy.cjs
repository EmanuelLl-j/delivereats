const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');
module.exports = (config, { allowLocalHttp = false } = {}) => withAndroidManifest(config, result => {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
  app.$['android:usesCleartextTraffic'] = String(allowLocalHttp);
  app.$['android:allowBackup'] = 'false';
  // Image-picker can leave a removal marker after a previous prebuild.
  // Audio calls require this permission; runtime consent is still mandatory.
  const permissions = result.modResults.manifest['uses-permission'] || [];
  result.modResults.manifest['uses-permission'] = permissions.filter(item => item.$['android:name'] !== 'android.permission.RECORD_AUDIO');
  result.modResults.manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.RECORD_AUDIO' } });
  return result;
});
