const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { parseValues } = require('./imap.js');
const {
  attachmentLeavesOf,
  attachmentsOf,
  bodyPartsOf,
  decodeFilename,
  partsOf,
} = require('./structure.js');

/** Wie es vom Server kommt: der Text einer BODYSTRUCTURE, zerlegt wie im Abgleich. */
const structure = (text) => parseValues([`(${text})`])[0];

const TEXT_PART = '("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "7BIT" 120 4)';
const HTML_PART = '("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 900 12)';
const PDF_PART =
  '("APPLICATION" "PDF" ("NAME" "Rechnung.pdf") NIL NIL "BASE64" 1000 NIL' +
  ' ("attachment" ("FILENAME" "Rechnung.pdf")) NIL NIL)';

describe('attachmentsOf', () => {
  test('finds nothing in a plain text mail', () => {
    assert.deepEqual(attachmentsOf(structure(TEXT_PART)), []);
  });

  test('reads name, type, the size behind base64 and where the part lies', () => {
    const found = attachmentsOf(structure(`${TEXT_PART}${PDF_PART} "MIXED"`));
    assert.deepEqual(found, [
      { filename: 'Rechnung.pdf', mime: 'application/pdf', size: 750, part: '2', contentId: null },
    ]);
  });

  test('looks into nested parts and keeps a named inline image with its content id', () => {
    const image =
      '("IMAGE" "PNG" ("NAME" "logo.png") "<cid1>" NIL "BASE64" 400 NIL' +
      ' ("inline" ("FILENAME" "logo.png")) NIL NIL)';
    const alternative = `(${TEXT_PART}${HTML_PART} "ALTERNATIVE")`;
    const found = attachmentsOf(structure(`${alternative}${image}${PDF_PART} "MIXED"`));
    assert.deepEqual(
      found.map((entry) => [entry.filename, entry.part, entry.contentId]),
      [
        ['logo.png', '2', 'cid1'],
        ['Rechnung.pdf', '3', null],
      ],
    );
  });

  test('counts an image without a name as attachment when HTML can point to it', () => {
    const nameless = '("IMAGE" "GIF" NIL "<bild@x>" NIL "BASE64" 40 NIL NIL NIL NIL)';
    const related = `((${TEXT_PART}${HTML_PART} "ALTERNATIVE")${nameless} "RELATED")`;
    const found = attachmentsOf(structure(`${related}${PDF_PART} "MIXED"`));
    assert.deepEqual(
      found.map((entry) => [entry.mime, entry.part, entry.contentId]),
      [
        ['image/gif', '1.2', 'bild@x'],
        ['application/pdf', '2', null],
      ],
    );
  });

  test('leaves text parts alone even when they carry a disposition', () => {
    const inlineText =
      '("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "7BIT" 120 4 NIL ("inline" NIL) NIL NIL)';
    assert.deepEqual(attachmentsOf(structure(`${inlineText}${HTML_PART} "ALTERNATIVE"`)), []);
  });

  test('keeps an attachment the server did not name', () => {
    const nameless =
      '("APPLICATION" "OCTET-STREAM" NIL NIL NIL "BASE64" 8 NIL ("attachment" NIL) NIL NIL)';
    assert.deepEqual(attachmentsOf(structure(nameless)), [
      { filename: '', mime: 'application/octet-stream', size: 6, part: '1', contentId: null },
    ]);
  });

  test('decodes filenames written for the wire', () => {
    const extended =
      '("APPLICATION" "PDF" NIL NIL NIL "7BIT" 10 NIL' +
      ' ("attachment" ("FILENAME*" "utf-8\'\'Rechnung%20M%C3%A4rz.pdf")) NIL NIL)';
    const words =
      '("APPLICATION" "OCTET-STREAM" NIL NIL NIL "7BIT" 10 NIL' +
      ' ("attachment" ("FILENAME" "=?utf-8?Q?Gr=C3=BCsse=2Etxt?=")) NIL NIL)';
    assert.equal(attachmentsOf(structure(extended))[0].filename, 'Rechnung März.pdf');
    assert.equal(attachmentsOf(structure(words))[0].filename, 'Grüsse.txt');
    assert.equal(decodeFilename('einfach.txt'), 'einfach.txt');
  });

  test('says nothing when the server sends no structure', () => {
    assert.deepEqual(attachmentsOf(null), []);
    assert.deepEqual(attachmentsOf('NIL'), []);
  });
});

describe('parts and bodies', () => {
  test('numbers parts the way BODY[section] expects', () => {
    const alternative = `(${TEXT_PART}${HTML_PART} "ALTERNATIVE")`;
    const parts = partsOf(structure(`${alternative}${PDF_PART} "MIXED"`));
    assert.deepEqual(
      parts.map((leaf) => [leaf.section, leaf.mime, leaf.encoding]),
      [
        ['1.1', 'text/plain', '7bit'],
        ['1.2', 'text/html', 'quoted-printable'],
        ['2', 'application/pdf', 'base64'],
      ],
    );
    assert.equal(partsOf(structure(TEXT_PART))[0].section, '1');
  });

  test('finds the text and the HTML part, never an attached one', () => {
    const attachedHtml =
      '("TEXT" "HTML" ("NAME" "seite.html") NIL NIL "7BIT" 50 2 NIL' +
      ' ("attachment" ("FILENAME" "seite.html")) NIL NIL)';
    const onlyAttached = bodyPartsOf(structure(`${TEXT_PART}${attachedHtml} "MIXED"`));
    assert.equal(onlyAttached.plain.section, '1');
    assert.equal(onlyAttached.html, null);

    const alternative = `(${TEXT_PART}${HTML_PART} "ALTERNATIVE")`;
    const both = bodyPartsOf(structure(`${alternative}${attachedHtml} "MIXED"`));
    assert.deepEqual(
      [both.plain.section, both.html.section, both.html.charset],
      ['1.1', '1.2', 'utf-8'],
    );
    assert.deepEqual(
      attachmentLeavesOf(structure(`${alternative}${attachedHtml} "MIXED"`)).map((l) => l.mime),
      ['text/html'],
    );
  });
});
