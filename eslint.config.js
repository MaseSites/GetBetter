const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettier,
  {
    // Der Kontodienst laeuft in Node, nicht im Browser.
    files: ['services/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
        module: 'writable',
        require: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'services/*/data/**'],
  },
];
