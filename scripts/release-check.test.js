'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { checkRelease } = require('./release-check.js');

/** Eine App, wie sie im Repo steht — alles da. */
function config(overrides = {}) {
  return {
    expo: {
      name: 'GetBetter',
      slug: 'getbetter',
      version: '1.0.0',
      icon: './assets/icon.png',
      ios: {
        bundleIdentifier: 'ch.better.getbetter',
        infoPlist: { ITSAppUsesNonExemptEncryption: false },
      },
      android: {
        package: 'ch.better.getbetter',
        adaptiveIcon: {
          foregroundImage: './assets/android-icon-foreground.png',
          backgroundImage: './assets/android-icon-background.png',
        },
      },
      plugins: ['expo-router', ['expo-splash-screen', { image: './assets/splash-icon.png' }]],
      extra: { eas: { projectId: 'abc' } },
      ...overrides,
    },
  };
}

const allThere = () => true;
const HOSTED = {
  EXPO_PUBLIC_API_URL: 'https://api.example.ch',
  EXPO_PUBLIC_API_TOKEN: 'geheim',
};

test('eine vollstaendige App ist bereit — ohne Profil auch ohne Dienst im Netz', () => {
  const result = checkRelease({ config: config(), profile: null, env: {}, exists: allThere });
  assert.deepEqual(result, { errors: [], warnings: [] });
});

test('Kennungen muessen ch.better.<slug> sein, die Version wie 1.0.0', () => {
  const result = checkRelease({
    config: config({ version: '1', ios: { bundleIdentifier: 'com.other' } }),
    profile: null,
    env: {},
    exists: allThere,
  });
  assert.ok(result.errors.some((line) => line.includes('"version"')));
  assert.ok(result.errors.some((line) => line.includes('ios.bundleIdentifier')));
  // Ohne den Verschluesselungs-Hinweis nur eine Warnung.
  assert.ok(result.warnings.some((line) => line.includes('ITSAppUsesNonExemptEncryption')));
});

test('fehlende Bilder sind Fehler, ein fehlendes projectId nur eine Warnung', () => {
  const result = checkRelease({
    config: config({ extra: {} }),
    profile: null,
    env: {},
    exists: (file) => !file.endsWith('splash-icon.png'),
  });
  assert.deepEqual(
    result.errors.map((line) => line.split(':')[0]),
    ['Splash-Bild'],
  );
  assert.ok(result.warnings.some((line) => line.includes('eas init')));
});

test('preview und production brauchen einen Dienst im Netz: https und das Geheimnis', () => {
  const missing = checkRelease({ config: config(), profile: 'preview', env: {}, exists: allThere });
  assert.ok(missing.errors.some((line) => line.includes('EXPO_PUBLIC_API_URL fehlt')));
  assert.ok(missing.errors.some((line) => line.includes('EXPO_PUBLIC_API_TOKEN fehlt')));

  const plain = checkRelease({
    config: config(),
    profile: 'production',
    env: { ...HOSTED, EXPO_PUBLIC_API_URL: 'http://192.168.1.10:8090' },
    exists: allThere,
  });
  assert.ok(plain.errors.some((line) => line.includes('https://')));

  const hosted = checkRelease({
    config: config(),
    profile: 'production',
    env: HOSTED,
    exists: allThere,
  });
  assert.deepEqual(hosted.errors, []);
});

test('development darf gegen den Rechner nebenan bauen', () => {
  const result = checkRelease({
    config: config(),
    profile: 'development',
    env: {},
    exists: allThere,
  });
  assert.deepEqual(result.errors, []);
});
