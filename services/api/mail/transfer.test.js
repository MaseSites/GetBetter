const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { encodeQuotedPrintable } = require('./smtp.js');
const { createDecoder } = require('./transfer.js');

/** Schickt `wire` in Stuecken der Groesse `size` durch den Decoder. */
function decodeInChunks(encoding, wire, size) {
  const decoder = createDecoder(encoding);
  const out = [];
  for (let index = 0; index < wire.length; index += size) {
    out.push(decoder.write(wire.subarray(index, index + size)));
  }
  out.push(decoder.end());
  return Buffer.concat(out);
}

describe('createDecoder', () => {
  const bytes = Buffer.from(Array.from({ length: 5000 }, (_, index) => (index * 7919) % 256));

  test('decodes wrapped base64 at every chunk size', () => {
    const lines = bytes
      .toString('base64')
      .match(/.{1,76}/g)
      .join('\r\n');
    const wire = Buffer.from(`${lines}\r\n`, 'latin1');
    for (const size of [1, 2, 3, 5, 76, 77, 1000, wire.length]) {
      assert.deepEqual(decodeInChunks('base64', wire, size), bytes, `chunk ${size}`);
    }
  });

  test('decodes quoted-printable with escapes and soft breaks split anywhere', () => {
    const text = 'Grüezi = gut\tund   lang '.repeat(40);
    const wire = Buffer.from(encodeQuotedPrintable(text), 'latin1');
    assert.ok(wire.includes('=\r\n'), 'the sample needs soft line breaks');
    for (const size of [1, 2, 3, 4, 7, 75, 76, wire.length]) {
      assert.equal(decodeInChunks('quoted-printable', wire, size).toString('utf8'), text);
    }
    assert.equal(
      decodeInChunks('quoted-printable', Buffer.from('a=\r\nb=3'), 4).toString(),
      'ab=3',
    );
  });

  test('passes other encodings through', () => {
    assert.deepEqual(decodeInChunks('7bit', bytes, 333), bytes);
    assert.deepEqual(decodeInChunks('', bytes, 5000), bytes);
  });
});
