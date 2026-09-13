const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { discoverFolders, findSent, findTrash, folderNameFor, isRole } = require('./folders.js');

const folder = (name, flags = [], delimiter = '/') => ({ name, flags, delimiter });

describe('discoverFolders', () => {
  test('reads the roles from special use', () => {
    const found = discoverFolders([
      folder('INBOX'),
      folder('[Gmail]/Papierkorb', ['\\Trash']),
      folder('[Gmail]/Gesendet', ['\\Sent']),
      folder('[Gmail]/Spam', ['\\Junk']),
      folder('[Gmail]/Entwürfe', ['\\Drafts']),
      folder('[Gmail]/Alle Nachrichten', ['\\All']),
    ]);
    assert.deepEqual(found, [
      { role: 'inbox', name: 'INBOX' },
      { role: 'sent', name: '[Gmail]/Gesendet' },
      { role: 'drafts', name: '[Gmail]/Entwürfe' },
      { role: 'junk', name: '[Gmail]/Spam' },
      { role: 'trash', name: '[Gmail]/Papierkorb' },
    ]);
  });

  test('falls back to known names, also in modified UTF-7', () => {
    const found = discoverFolders([
      folder('INBOX', [], '.'),
      folder('INBOX.Gel&APY-scht', [], '.'),
      folder('INBOX.Gesendet', [], '.'),
      folder('INBOX.Spam', [], '.'),
      folder('INBOX.Archiv', [], '.'),
      folder('INBOX.Urlaub', [], '.'),
    ]);
    assert.deepEqual(
      found.map((entry) => [entry.role, entry.name]),
      [
        ['inbox', 'INBOX'],
        ['sent', 'INBOX.Gesendet'],
        ['junk', 'INBOX.Spam'],
        ['trash', 'INBOX.Gel&APY-scht'],
        ['archive', 'INBOX.Archiv'],
      ],
    );
  });

  test('skips folders nobody can open and always keeps an inbox', () => {
    const found = discoverFolders([
      folder('Trash', ['\\Noselect']),
      folder('Papierkorb', ['\\HasNoChildren']),
    ]);
    assert.deepEqual(found, [
      { role: 'inbox', name: 'INBOX' },
      { role: 'trash', name: 'Papierkorb' },
    ]);
  });

  test('gives one folder only one role', () => {
    const found = discoverFolders([folder('INBOX'), folder('Archiv', ['\\Junk', '\\Archive'])]);
    assert.deepEqual(found, [
      { role: 'inbox', name: 'INBOX' },
      { role: 'junk', name: 'Archiv' },
    ]);
  });

  test('finds trash and sent for the send and delete paths', () => {
    const list = [folder('INBOX'), folder('Trash', ['\\Trash']), folder('Sent', ['\\Sent'])];
    assert.equal(findTrash(list), 'Trash');
    assert.equal(findSent(list), 'Sent');
    assert.equal(findSent([folder('INBOX')]), null);
    assert.equal(folderNameFor(discoverFolders(list), 'junk'), null);
    assert.equal(folderNameFor(undefined, 'inbox'), null);
  });

  test('knows which role names are real', () => {
    assert.equal(isRole('junk'), true);
    assert.equal(isRole('posteingang'), false);
    assert.equal(isRole(undefined), false);
  });
});
