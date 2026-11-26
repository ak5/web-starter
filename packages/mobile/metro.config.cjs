const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 1;
config.resolver.useWatchman = false;

module.exports = config;
