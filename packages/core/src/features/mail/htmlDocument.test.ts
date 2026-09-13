import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_BODY_HEIGHT, MIN_BODY_HEIGHT, estimateBodyHeight, mailDocument } from './htmlDocument';

const style = {
  text: '#111',
  muted: '#555',
  link: '#00f',
  background: '#fff',
  border: '#ddd',
  fontFamily: 'system-ui',
  fontSize: 15,
  lineHeight: 21,
  indent: 8,
};

test('das Dokument verbietet Skripte und oeffnet Links in einem neuen Fenster', () => {
  const doc = mailDocument('<p>Hallo</p>', style);
  assert.match(doc, /Content-Security-Policy" content="default-src 'none';/);
  assert.doesNotMatch(doc, /script-src/);
  assert.match(doc, /<base target="_blank">/);
  assert.match(doc, /<body><p>Hallo<\/p><\/body>/);
  assert.match(doc, /font-size:15px;line-height:21px/);
});

test('die Hoehe waechst mit dem Text und bleibt in ihren Grenzen', () => {
  const base = { html: '', width: 300, fontSize: 15, lineHeight: 21 };
  const short = estimateBodyHeight({ ...base, text: 'Hallo' });
  const long = estimateBodyHeight({ ...base, text: 'Wort '.repeat(400) });
  assert.equal(short, MIN_BODY_HEIGHT);
  assert.ok(long > short);
  assert.equal(estimateBodyHeight({ ...base, text: 'x\n'.repeat(10_000) }), MAX_BODY_HEIGHT);
});

test('Bilder zaehlen, Zaehlpixel und blockierte nicht', () => {
  const base = { text: 'x\n'.repeat(10), width: 300, fontSize: 15, lineHeight: 21 };
  const plain = estimateBodyHeight({ ...base, html: '' });
  const pixel = estimateBodyHeight({ ...base, html: '<img src="a" width="1" height="1">' });
  const blocked = estimateBodyHeight({ ...base, html: '<img src="a" data-remote-image="1">' });
  const photo = estimateBodyHeight({ ...base, html: '<img src="a" height="400">' });
  assert.equal(pixel, plain);
  assert.equal(blocked, plain);
  assert.equal(photo, plain + 400);
});
