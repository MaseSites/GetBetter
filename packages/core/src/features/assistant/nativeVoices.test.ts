import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rawOfNative } from './nativeVoices';
import { tierOf } from './voices';

test('rawOfNative: iOS-Enhanced klingt natuerlich, Android-Netzstimmen sauber, der Rest blechern', () => {
  const enhanced = rawOfNative({
    identifier: 'com.apple.voice.enhanced.de-DE.Anna',
    name: 'Anna',
    language: 'de-DE',
    quality: 'Enhanced',
  });
  assert.equal(enhanced.uri, 'com.apple.voice.enhanced.de-DE.Anna');
  assert.equal(enhanced.tag, 'de-DE');
  assert.equal(tierOf(enhanced), 'natural');

  const network = rawOfNative({
    identifier: 'de-de-x-deb-network',
    name: 'de-de-x-deb',
    language: 'de_DE',
  });
  assert.equal(network.local, false);
  assert.equal(network.tag, 'de-DE');
  assert.equal(tierOf(network), 'clear');

  const plain = rawOfNative({
    identifier: 'de-de-x-deb-local',
    name: 'de-de-x-deb',
    language: 'de-DE',
    quality: 'Default',
  });
  assert.equal(plain.local, true);
  assert.equal(tierOf(plain), 'basic');
});
