/**
 * Startet alles auf einmal: die Datenbank und die fuenf Apps.
 *
 * Ohne das muesste man sechs Fenster oeffnen — und wer eine App vergisst,
 * klickt in GetBetter auf eine Karte und landet im Leeren.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const SERVICES = [
  { name: 'db      ', command: 'node', args: ['services/api/server.js'] },
  {
    name: 'getbetter',
    command: 'npm',
    args: ['run', 'web', '-w', 'apps/getbetter', '--', '--port', '8081'],
  },
  {
    name: 'family  ',
    command: 'npm',
    args: ['run', 'web', '-w', 'apps/betterfamily', '--', '--port', '8082'],
  },
  {
    name: 'gym     ',
    command: 'npm',
    args: ['run', 'web', '-w', 'apps/bettergym', '--', '--port', '8083'],
  },
  {
    name: 'ai      ',
    command: 'npm',
    args: ['run', 'web', '-w', 'apps/betterai', '--', '--port', '8084'],
  },
  {
    name: 'money   ',
    command: 'npm',
    args: ['run', 'web', '-w', 'apps/bettermoney', '--', '--port', '8085'],
  },
];

let stopping = false;

const children = SERVICES.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    cwd: ROOT,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = (line) => `[${name}] ${line}`;
  const forward = (stream, target) => {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (line.trim().length > 0) target.write(`${prefix(line)}\n`);
      }
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  // Stirbt einer gleich wieder, geht das zwischen den anderen unter. Dann
  // laeuft die App weiter gegen einen Dienst, den es gar nicht mehr gibt.
  child.on('exit', (code) => {
    if (!stopping && code !== 0) process.stderr.write(`[${name}] hat aufgegeben (Code ${code})\n`);
  });

  return child;
});

function stopAll() {
  stopping = true;
  for (const child of children) child.kill();
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('exit', stopAll);

process.stdout.write(
  [
    '',
    'GetBetter    http://localhost:8081',
    'BetterFamily http://localhost:8082',
    'BetterGym    http://localhost:8083',
    'BetterAi     http://localhost:8084',
    'BetterMoney  http://localhost:8085',
    'Datenbank    http://localhost:8090',
    '',
  ].join('\n'),
);
