#!/usr/bin/env node
'use strict';

/**
 * Prueft, ob eine App so weit ist, dass man sie auf ein Handy bauen kann —
 * und ob ein Bau fuer Tester (`preview`) oder den Store (`production`) alles
 * hat, was er braucht. Laeuft vor jedem Bau auf den Servern von EAS
 * (`eas-build-pre-install` in `apps/<name>/package.json`, dort ist
 * `EAS_BUILD_PROFILE` gesetzt) und von Hand mit `npm run release:check`.
 *
 * Nur Node-Kernmodule, plain JavaScript: EAS fuehrt den Haken aus, bevor
 * irgendetwas installiert ist. `checkRelease` ist rein und getestet
 * (`release-check.test.js`); der Rest liest Dateien und schreibt aufs Terminal.
 */
const fs = require('node:fs');
const path = require('node:path');

/** Alle Kennungen im Store fangen so an. */
const ID_PREFIX = 'ch.better.';
/** Ein Bau fuer andere Leute braucht einen Dienst im Netz. */
const NETWORK_PROFILES = new Set(['preview', 'production']);
const SEMVER = /^\d+\.\d+\.\d+$/u;

/**
 * Die reine Pruefung: `config` ist `app.json`, `profile` das Bauprofil (oder
 * null), `env` die Umgebung, `exists(relativePath)` sagt, ob eine Datei da ist.
 * Fehler verhindern den Bau, Warnungen nicht.
 */
function checkRelease({ config, profile, env, exists }) {
  const errors = [];
  const warnings = [];
  const expo = config && typeof config === 'object' ? config.expo : null;
  if (!expo || typeof expo !== 'object') {
    return { errors: ['app.json hat keinen Abschnitt "expo".'], warnings };
  }

  const slug = typeof expo.slug === 'string' ? expo.slug : '';
  if (!slug) errors.push('"slug" fehlt.');
  if (typeof expo.name !== 'string' || expo.name.trim() === '') errors.push('"name" fehlt.');
  if (typeof expo.version !== 'string' || !SEMVER.test(expo.version)) {
    errors.push(`"version" muss wie 1.0.0 aussehen (ist ${JSON.stringify(expo.version)}).`);
  }

  const ios = expo.ios ?? {};
  const android = expo.android ?? {};
  const expectedId = `${ID_PREFIX}${slug}`;
  if (ios.bundleIdentifier !== expectedId) {
    errors.push(`ios.bundleIdentifier muss ${expectedId} sein (ist ${ios.bundleIdentifier}).`);
  }
  if (android.package !== expectedId) {
    errors.push(`android.package muss ${expectedId} sein (ist ${android.package}).`);
  }
  if (ios.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
    warnings.push(
      'ios.infoPlist.ITSAppUsesNonExemptEncryption fehlt — sonst fragt TestFlight bei jedem Bau nach der Verschluesselung.',
    );
  }

  const images = [
    ['icon', expo.icon],
    ['android.adaptiveIcon.foregroundImage', android.adaptiveIcon?.foregroundImage],
    ['android.adaptiveIcon.backgroundImage', android.adaptiveIcon?.backgroundImage],
  ];
  const splash = (expo.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  images.push(['Splash-Bild', splash?.[1]?.image]);
  for (const [label, file] of images) {
    if (typeof file !== 'string' || file === '') errors.push(`${label} fehlt in app.json.`);
    else if (!exists(file)) errors.push(`${label}: ${file} gibt es nicht — node scripts/icons.js.`);
  }

  if (!expo.extra?.eas?.projectId) {
    warnings.push('extra.eas.projectId fehlt — einmal "eas init" im App-Ordner, dann einchecken.');
  }

  if (profile && NETWORK_PROFILES.has(profile)) {
    const url = env.EXPO_PUBLIC_API_URL ?? '';
    if (url === '') {
      errors.push(
        `Profil ${profile}: EXPO_PUBLIC_API_URL fehlt — die App braucht einen Dienst im Netz (eas env:create).`,
      );
    } else if (!/^https:\/\/[^/\s]+/u.test(url)) {
      errors.push(
        `Profil ${profile}: EXPO_PUBLIC_API_URL muss mit https:// beginnen (ist ${url}) — iOS und Android lassen sonst keine Verbindung zu.`,
      );
    }
    if (!env.EXPO_PUBLIC_API_TOKEN) {
      errors.push(
        `Profil ${profile}: EXPO_PUBLIC_API_TOKEN fehlt — dasselbe Geheimnis wie BETTER_API_TOKEN beim Dienst, sonst steht die Datenbank offen im Netz.`,
      );
    }
  }

  return { errors, warnings };
}

/** Liest app.json eines App-Ordners und prueft ihn; gibt die Meldungen zurueck. */
function checkAppDir(dir, profile, env) {
  const file = path.join(dir, 'app.json');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { errors: [`${file}: ${error.message}`], warnings: [] };
  }
  return checkRelease({
    config,
    profile,
    env,
    exists: (relative) => fs.existsSync(path.resolve(dir, relative)),
  });
}

function appDirs(root) {
  const here = process.cwd();
  if (fs.existsSync(path.join(here, 'app.json'))) return [here];
  const apps = path.join(root, 'apps');
  return fs
    .readdirSync(apps)
    .map((name) => path.join(apps, name))
    .filter((dir) => fs.existsSync(path.join(dir, 'app.json')));
}

function main() {
  const root = path.resolve(__dirname, '..');
  const flag = process.argv.indexOf('--profile');
  const profile = flag >= 0 ? process.argv[flag + 1] : (process.env.EAS_BUILD_PROFILE ?? null);
  let failed = false;
  for (const dir of appDirs(root)) {
    const { errors, warnings } = checkAppDir(dir, profile, process.env);
    const name = path.basename(dir);
    const state = errors.length > 0 ? 'nicht bereit' : 'bereit';
    process.stdout.write(`${name}: ${state}${profile ? ` (Profil ${profile})` : ''}\n`);
    for (const line of errors) process.stdout.write(`  ✗ ${line}\n`);
    for (const line of warnings) process.stdout.write(`  ! ${line}\n`);
    if (errors.length > 0) failed = true;
  }
  process.exitCode = failed ? 1 : 0;
}

module.exports = { checkRelease, ID_PREFIX, NETWORK_PROFILES };

if (require.main === module) main();
