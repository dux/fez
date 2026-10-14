import { describe, expect, test } from 'bun:test';
import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = path.resolve(import.meta.dir, '..');

describe('fez version', () => {
  // the command reads .version next to its own bin/ dir, so run a copy
  const install = (stamp) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-version-'));
    for (const file of ['bin/fez', 'bin/fez-version']) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.copyFileSync(path.join(root, file), path.join(dir, file));
      fs.chmodSync(path.join(dir, file), 0o755);
    }
    if (stamp !== undefined) {
      fs.writeFileSync(path.join(dir, '.version'), stamp);
    }
    return dir;
  };

  const run = async (dir, args = []) =>
    (await $`${path.join(dir, 'bin/fez')} version ${args}`.quiet().nothrow()).stdout
      .toString()
      .trim();

  test('prints the version line from .version', async () => {
    const dir = install('# stamped by vstamp\noffset: 14\nversion: 3.5.7\n');
    expect(await run(dir)).toBe('3.5.7');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('prints dev for a checkout that was never stamped', async () => {
    for (const stamp of [undefined, '', 'offset: 14\n']) {
      const dir = install(stamp);
      expect(await run(dir)).toBe('dev');
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
