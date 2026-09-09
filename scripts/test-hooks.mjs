import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE = path.resolve(process.cwd(), 'packages', 'core', 'src');
const ENDINGS = ['.ts', '.tsx', '/index.ts'];

/**
 * Loest `@/…` auf den Kern auf und ergaenzt fehlende Endungen — so, wie es
 * Metro in der App auch tut. Synchron, weil `registerHooks` es so will.
 */
export function resolve(specifier, context, next) {
  let target = specifier;
  if (target.startsWith('@/')) target = pathToFileURL(path.join(CORE, target.slice(2))).href;

  const relative = target.startsWith('.') || target.startsWith('file:');
  if (relative && path.extname(target) === '') {
    const base = target.startsWith('file:')
      ? fileURLToPath(target)
      : path.resolve(path.dirname(fileURLToPath(context.parentURL)), target);
    for (const ending of ENDINGS) {
      if (existsSync(base + ending)) return next(pathToFileURL(base + ending).href, context);
    }
  }

  return next(target, context);
}
