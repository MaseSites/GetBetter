const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettier,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**'],
  },
];
