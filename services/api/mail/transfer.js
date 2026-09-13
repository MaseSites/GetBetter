/**
 * Transfer-Kodierungen im Strom entschluesseln — fuer Anhaenge, die Stueck fuer
 * Stueck vom Mailserver kommen und ebenso weiter an die App gehen.
 *
 * Ein Stueck kann mitten in einer Base64-Gruppe oder einem `=3D` enden; was
 * noch nicht vollstaendig ist, wartet auf das naechste Stueck.
 */
const { decodeQuotedPrintable } = require('./mime.js');

function createBase64Decoder() {
  let carry = '';
  return {
    write(chunk) {
      // Padding steht laut RFC 2045 nur am Ende; Zeilenumbrueche zaehlen nicht.
      const clean = carry + chunk.toString('latin1').replace(/[^A-Za-z0-9+/]/g, '');
      const usable = clean.length - (clean.length % 4);
      carry = clean.slice(usable);
      return Buffer.from(clean.slice(0, usable), 'base64');
    },
    end() {
      const rest = carry;
      carry = '';
      return Buffer.from(rest, 'base64');
    },
  };
}

/** Haelt ein `=`, `=4` oder `=` mit Leerraum vor einem noch fehlenden Zeilenende zurueck. */
function createQuotedPrintableDecoder() {
  let carry = '';
  return {
    write(chunk) {
      const text = carry + chunk.toString('latin1');
      const at = text.lastIndexOf('=');
      const hold = at !== -1 && /^(?:[0-9A-Fa-f]?|[ \t]*\r?)$/.test(text.slice(at + 1));
      carry = hold ? text.slice(at) : '';
      return decodeQuotedPrintable(Buffer.from(hold ? text.slice(0, at) : text, 'latin1'));
    },
    end() {
      const rest = carry;
      carry = '';
      return decodeQuotedPrintable(Buffer.from(rest, 'latin1'));
    },
  };
}

function createIdentityDecoder() {
  return { write: (chunk) => chunk, end: () => Buffer.alloc(0) };
}

/** `base64`, `quoted-printable` — alles andere (7bit, 8bit, binary) geht unveraendert durch. */
function createDecoder(encoding) {
  const name = String(encoding ?? '').toLowerCase();
  if (name === 'base64') return createBase64Decoder();
  if (name === 'quoted-printable') return createQuotedPrintableDecoder();
  return createIdentityDecoder();
}

module.exports = { createDecoder };
