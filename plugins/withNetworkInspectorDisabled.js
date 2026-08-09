const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Keep Expo Dev Client's OkHttp network-inspector bytecode instrumentation out
 * of every generated Android native project. The interceptor has been
 * observed to alter authenticated JSON POSTs on the physical debug client.
 */
module.exports = function withNetworkInspectorDisabled(config) {
  return withGradleProperties(config, (modConfig) => {
    const property = modConfig.modResults.find(
      (item) => item.type === 'property' && item.key === 'EX_DEV_CLIENT_NETWORK_INSPECTOR'
    );
    if (property) {
      property.value = 'false';
    } else {
      modConfig.modResults.push({
        type: 'property',
        key: 'EX_DEV_CLIENT_NETWORK_INSPECTOR',
        value: 'false',
      });
    }
    return modConfig;
  });
};
