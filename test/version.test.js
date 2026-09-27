import { describe, expect, test } from 'bun:test';
import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { formatVersion } from '../src/fez/lib/version.js';

const root = path.resolve(import.meta.dir, '..');

describe('formatVersion', () => {
  test('renders v<commit count> dotted, like dboss and lux-fw', () => {
    for (const [raw, dotted] of [
      ['v357', 'v3.5.7'],
      ['v1123', 'v11.2.3'],
      ['v81', 'v0.8.1'],
      ['v5', 'v0.0.5'],
      ['v100', 'v1.0.0'],
      ['v357\n', 'v3.5.7'],
    ]) {
      expect(formatVersion(raw)).toBe(dotted);
    }
  });

  test('passes anything that is not v<digits> through', () => {
    for (const raw of ['dev', '', 'v1.2.3', '0.13.0']) {
      expect(formatVersion(raw)).toBe(raw);
    }
  });
});

describe('fez version', () => {
  // the command reads .version next to its own bin/ dir, so run a copy
  const install = (stamp) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-version-'));
    for (const file of ['bin/fez', 'bin/fez-version', 'src/fez/lib/version.js']) {
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

  test('prints the dotted stamp, or the raw one with --raw', async () => {
    const dir = install('v357\n');
    expect(await run(dir)).toBe('v3.5.7');
    expect(await run(dir, ['--raw'])).toBe('v357');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('prints dev for a checkout that was never stamped', async () => {
    const dir = install();
    expect(await run(dir)).toBe('dev');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
