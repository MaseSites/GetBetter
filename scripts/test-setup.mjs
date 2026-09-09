/**
 * Haengt die Aufloesung fuer die Tests ein: `node --import ./scripts/test-setup.mjs --test …`
 * Node laesst TypeScript laufen (die Typen streift es ab), kennt aber weder
 * Importe ohne Endung noch den Alias `@/`. Beides regelt test-hooks.mjs.
 */
import { registerHooks } from 'node:module';

import { resolve } from './test-hooks.mjs';

registerHooks({ resolve });
