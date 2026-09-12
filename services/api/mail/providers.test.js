const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectProvider, requiresOAuth } = require('./providers.js');

const pick = (email) => {
  const found = detectProvider(email);
  return [
    found.provider,
    `${found.imapHost}:${found.imapPort}:${found.imapSecure}`,
    `${found.smtpHost}:${found.smtpPort}:${found.smtpSecure}`,
    found.note,
  ];
};

test('knows the Swiss and German providers', () => {
  for (const domain of ['gmx.ch', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.com']) {
    assert.deepEqual(pick(`hans@${domain}`), [
      'gmx',
      'imap.gmx.net:993:true',
      'mail.gmx.net:465:true',
      'enable_imap',
    ]);
  }
  assert.deepEqual(pick('Hans@WEB.DE'), [
    'webde',
    'imap.web.de:993:true',
    'smtp.web.de:587:false',
    'enable_imap',
  ]);
  assert.deepEqual(pick('a@bluewin.ch'), [
    'bluewin',
    'imaps.bluewin.ch:993:true',
    'smtps.bluewin.ch:465:true',
    null,
  ]);
  assert.deepEqual(pick('a@sunrise.ch'), [
    'sunrise',
    'imap.sunrise.ch:993:true',
    'smtp.sunrise.ch:587:false',
    null,
  ]);
  assert.deepEqual(pick('a@posteo.de'), [
    'posteo',
    'posteo.de:993:true',
    'posteo.de:465:true',
    null,
  ]);
  assert.deepEqual(pick('a@mail.ch'), [
    'mailch',
    'imap.mail.ch:993:true',
    'smtp.mail.ch:465:true',
    null,
  ]);
});

test('flags providers that need an app password', () => {
  assert.deepEqual(pick('a@gmail.com'), [
    'gmail',
    'imap.gmail.com:993:true',
    'smtp.gmail.com:465:true',
    'app_password',
  ]);
  assert.equal(detectProvider('a@googlemail.com').provider, 'gmail');
  assert.deepEqual(pick('a@yahoo.de'), [
    'yahoo',
    'imap.mail.yahoo.com:993:true',
    'smtp.mail.yahoo.com:465:true',
    'app_password',
  ]);
  for (const domain of ['icloud.com', 'me.com', 'mac.com']) {
    assert.deepEqual(pick(`a@${domain}`), [
      'icloud',
      'imap.mail.me.com:993:true',
      'smtp.mail.me.com:587:false',
      'app_password',
    ]);
  }
});

test('marks Microsoft accounts as OAuth only', () => {
  for (const email of [
    'a@outlook.com',
    'a@hotmail.ch',
    'a@hotmail.com',
    'a@live.de',
    'a@msn.com',
  ]) {
    assert.equal(detectProvider(email).note, 'oauth_only', email);
  }
  assert.equal(requiresOAuth('outlook.office365.com'), true);
  assert.equal(requiresOAuth('imap-mail.outlook.com'), true);
  assert.equal(requiresOAuth('imap.gmx.net'), false);
  assert.equal(requiresOAuth('outlook.example.ch'), false);
});

test('guesses hosts for unknown domains', () => {
  const found = detectProvider('info@meine-firma.ch');
  assert.deepEqual(found, {
    provider: 'custom',
    label: 'meine-firma.ch',
    imapHost: 'imap.meine-firma.ch',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.meine-firma.ch',
    smtpPort: 465,
    smtpSecure: true,
    note: null,
  });
});
