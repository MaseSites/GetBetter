import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_AVATAR } from '../avatar/style';
import { canPersonalize, effectivePersonalization } from './entitlement';
import { onPricedAppsChange, pricedApps, rememberPricedApps } from './pricedApps';
import { DEFAULT_PRICED_APPS, PLAN_PRICES_CHF } from './prices';

const owl = { kind: 'owl', color: 'sun', eyes: 'sparkle', accessory: 'glasses' } as const;

const styled = {
  themeMode: 'dark',
  accentKey: 'blue',
  themePreset: 'mono',
  backdrop: 'forest',
  assistantAvatar: owl,
  assistantVoice: 'eleven:abc',
  assistantName: '  Luma ',
};

test('canPersonalize: nur ein Abo einer App mit Preis zaehlt', () => {
  assert.equal(canPersonalize(null), false);
  assert.equal(canPersonalize({}), false);
  assert.equal(canPersonalize({ paidApps: [] }), false);
  assert.equal(canPersonalize({ paidApps: ['bettermoney'] }), false);
  assert.equal(canPersonalize({ paidApps: ['bettermoney', 'getbetter'] }), true);
  for (const app of ['getbetter', 'betterfamily', 'bettergym', 'betterai']) {
    assert.equal(canPersonalize({ paidApps: [app] }), true, app);
  }
  // Sagt der Dienst, BetterMoney habe jetzt einen Preis, gilt das.
  assert.equal(canPersonalize({ paidApps: ['bettermoney'] }, ['bettermoney']), true);
});

test('die Apps mit Preis kommen aus den Preisen', () => {
  assert.deepEqual(DEFAULT_PRICED_APPS, ['getbetter', 'betterfamily', 'bettergym', 'betterai']);
  assert.equal(PLAN_PRICES_CHF.bettermoney, null);
});

test('ohne Abo gilt der Standard, der Modus bleibt', () => {
  const free = effectivePersonalization({ ...styled, paidApps: ['bettermoney'] });
  assert.deepEqual(free, {
    canPersonalize: false,
    mode: 'dark',
    accent: 'signal',
    preset: 'clean',
    backdrop: undefined,
    avatar: DEFAULT_AVATAR,
    voice: undefined,
    assistantName: '',
  });
  assert.equal(effectivePersonalization(null).mode, 'light');
  assert.equal(effectivePersonalization({ themeMode: 'system' }).mode, 'system');
});

test('mit Abo gilt die eigene Wahl — tolerant gelesen', () => {
  const paid = effectivePersonalization({ ...styled, paidApps: ['betterai'] });
  assert.deepEqual(paid, {
    canPersonalize: true,
    mode: 'dark',
    accent: 'blue',
    preset: 'mono',
    backdrop: 'forest',
    avatar: owl,
    voice: 'eleven:abc',
    assistantName: 'Luma',
  });
  const broken = effectivePersonalization({
    paidApps: ['getbetter'],
    themeMode: 'neon',
    accentKey: 'gold',
    themePreset: 'wild',
    backdrop: '',
    assistantVoice: '',
    assistantAvatar: 'owl',
  });
  assert.deepEqual(
    [broken.mode, broken.accent, broken.preset, broken.backdrop, broken.voice, broken.assistantName],
    ['light', 'signal', 'clean', undefined, undefined, ''],
  );
  assert.deepEqual(broken.avatar, DEFAULT_AVATAR);
});

test('rememberPricedApps: nur neue, gueltige Listen wecken', () => {
  const heard: string[] = [];
  const stop = onPricedAppsChange(() => heard.push('x'));
  try {
    rememberPricedApps(DEFAULT_PRICED_APPS);
    rememberPricedApps('getbetter');
    rememberPricedApps(null);
    assert.deepEqual(heard, []);
    rememberPricedApps(['getbetter', 5, 'bettermoney']);
    assert.deepEqual(pricedApps(), ['getbetter', 'bettermoney']);
    assert.deepEqual(heard, ['x']);
  } finally {
    rememberPricedApps(DEFAULT_PRICED_APPS);
    stop();
  }
  assert.deepEqual(pricedApps(), DEFAULT_PRICED_APPS);
});
