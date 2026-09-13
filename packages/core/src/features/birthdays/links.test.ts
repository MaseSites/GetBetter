import assert from 'node:assert/strict';
import { test } from 'node:test';

import { linkHost, openableUrl, phoneDigits, smsUrl, telUrl } from './links';

test('Nummern ohne Leerzeichen, das Plus bleibt', () => {
  assert.equal(phoneDigits('+41 79 123 45 67'), '+41791234567');
  assert.equal(phoneDigits('079 / 123-45-67'), '0791234567');
  assert.equal(telUrl('+41 79 123 45 67'), 'tel:+41791234567');
});

test('SMS: iOS trennt den Text mit &, der Rest mit ?', () => {
  assert.equal(smsUrl('079 123', 'Alles Gute!', 'ios'), 'sms:079123&body=Alles%20Gute!');
  assert.equal(smsUrl('079 123', 'Alles Gute!', 'android'), 'sms:079123?body=Alles%20Gute!');
  assert.equal(smsUrl('079 123', null, 'ios'), 'sms:079123');
});

test('nur http und https lassen sich oeffnen', () => {
  assert.equal(openableUrl('https://galaxus.ch/buch'), 'https://galaxus.ch/buch');
  assert.equal(openableUrl('galaxus.ch/buch'), 'https://galaxus.ch/buch');
  assert.equal(openableUrl('javascript:alert(1)'), null);
  assert.equal(openableUrl('ein Buch'), null);
  assert.equal(openableUrl('Buch'), null);
  assert.equal(openableUrl(''), null);
  assert.equal(openableUrl(undefined), null);
});

test('zeigt vom Link nur die Adresse', () => {
  assert.equal(linkHost('https://www.galaxus.ch/de/s1/product'), 'galaxus.ch');
});
