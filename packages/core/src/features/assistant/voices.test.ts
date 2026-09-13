import assert from 'node:assert/strict';
import { test } from 'node:test';

import { choosableVoices, labelOf, rankVoices, tierOf } from './voices';

const hedda = {
  uri: 'Microsoft Hedda - German (Germany)',
  name: 'Microsoft Hedda - German (Germany)',
  tag: 'de-DE',
  local: true,
};
const google = { uri: 'Google Deutsch', name: 'Google Deutsch', tag: 'de-DE', local: false };
const katja = {
  uri: 'Microsoft Katja Online (Natural) - German (Germany)',
  name: 'Microsoft Katja Online (Natural) - German (Germany)',
  tag: 'de-DE',
  local: false,
};
const leni = {
  uri: 'Microsoft Leni Online (Natural) - German (Switzerland)',
  name: 'Microsoft Leni Online (Natural) - German (Switzerland)',
  tag: 'de-CH',
  local: false,
};
const anna = {
  uri: 'com.apple.voice.enhanced.de-DE.Anna',
  name: 'Anna (Enhanced)',
  tag: 'de-DE',
  local: true,
};
const samantha = { uri: 'Samantha', name: 'Samantha', tag: 'en-US', local: true };

test('natuerlich am Namen, aus dem Netz klar, eingebaut blechern', () => {
  assert.equal(tierOf(katja), 'natural');
  assert.equal(tierOf(anna), 'natural');
  assert.equal(tierOf(google), 'clear');
  assert.equal(tierOf(hedda), 'basic');
});

test('kurze Namen ohne Hersteller, Zusatz und Sprache', () => {
  assert.equal(labelOf(katja.name), 'Katja');
  assert.equal(labelOf(leni.name), 'Leni');
  assert.equal(labelOf(hedda.name), 'Hedda');
  assert.equal(labelOf(anna.name), 'Anna');
  // Bei Google ist der Name nur die Sprache — dann bleibt er ganz.
  assert.equal(labelOf(google.name), 'Google Deutsch');
});

test('natuerlich zuerst, bei gleicher Guete die Schweizer Fassung, fremde Sprachen nie', () => {
  const ranked = rankVoices([hedda, google, katja, leni, samantha], 'de', 'de-CH');
  assert.deepEqual(
    ranked.map((voice) => voice.label),
    ['Leni', 'Katja', 'Google Deutsch', 'Hedda'],
  );
});

test('die blechernen fallen weg, sobald es zwei bessere gibt', () => {
  const edge = choosableVoices(rankVoices([hedda, google, katja], 'de', 'de-CH'));
  assert.deepEqual(
    edge.map((voice) => voice.label),
    ['Katja', 'Google Deutsch'],
  );
  // Chrome unter Windows: nur eine bessere — dann bleiben alle, die bessere oben.
  const chrome = choosableVoices(rankVoices([hedda, google], 'de', 'de-CH'));
  assert.deepEqual(
    chrome.map((voice) => voice.label),
    ['Google Deutsch', 'Hedda'],
  );
});
