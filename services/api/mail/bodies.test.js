const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { describe, test } = require('node:test');

// Der Speicher darf nie auf services/api/data zeigen, auch wenn diese Tests ihn nicht anfassen.
process.env.BETTER_DATA_DIR = path.join(os.tmpdir(), 'better-bodies-test-unused');

const { attachmentHeaders, safeFilename } = require('./bodies.js');

describe('attachment headers', () => {
  test('strips paths, control characters and edge dots from filenames', () => {
    assert.equal(safeFilename('../../etc/passwd', 'text/plain'), '_.._etc_passwd');
    assert.equal(
      safeFilename('C:\\Users\\x\\Rechnung.pdf', 'application/pdf'),
      'C__Users_x_Rechnung.pdf',
    );
    assert.equal(safeFilename('bad\r\nX-Evil: 1.txt', 'text/plain'), 'badX-Evil_ 1.txt');
    assert.equal(safeFilename(' ... ', 'application/pdf'), 'attachment.pdf');
    assert.equal(safeFilename('', 'application/vnd.ms-excel'), 'attachment');
    assert.equal(Array.from(safeFilename('ä'.repeat(400), 'text/plain')).length, 150);
    assert.equal(safeFilename('\uD83D', 'text/plain'), '\uFFFD');
  });

  test('serves images and PDF inline, everything else as a download, never active types', () => {
    const headers = (mime) => attachmentHeaders({ mime, filename: 'Grüsse "2026".txt' });
    assert.equal(headers('image/png')['Content-Type'], 'image/png');
    assert.match(headers('image/png')['Content-Disposition'], /^inline;/);
    assert.match(headers('image/png')['Content-Security-Policy'], /sandbox/);
    assert.equal(headers('application/pdf')['Content-Security-Policy'], undefined);
    assert.equal(headers('image/jpg')['Content-Type'], 'image/jpeg');
    for (const mime of [
      'text/html',
      'image/svg+xml',
      'application/xhtml+xml',
      'text/xml',
      'application/javascript',
      'bogus type',
    ]) {
      assert.equal(headers(mime)['Content-Type'], 'application/octet-stream', mime);
      assert.match(headers(mime)['Content-Disposition'], /^attachment;/, mime);
    }
    assert.equal(headers('text/plain')['Content-Type'], 'text/plain');
    assert.equal(headers('text/plain')['X-Content-Type-Options'], 'nosniff');
    assert.equal(
      headers('application/zip')['Content-Disposition'],
      `attachment; filename="Grusse _2026_.txt"; filename*=UTF-8''Gr%C3%BCsse%20_2026_.txt`,
    );
  });
});
