// Solmar Bay — a GTA-style open-world game for make.fun gta6-01.
// main.ts (Node 22, standard library only): copies the static game in game/ and the
// screenshots in screenshots/ from beside this file into the output directory
// (/output in the grader, or MAKEFUN_OUTPUT_DIR locally) and writes
// /output/dossier.json with the kit's vendored buildDossier library.
// No network, no install, no build step: run it with `node main.ts`.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps from the gate (reference/gate.json): dossier text at most 160 KiB,
// at most 4 screenshots of at most 256 KiB each, game/ at most 993 entries
// and 48 MiB, no path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`Solmar Bay handed in to ${out}`);
