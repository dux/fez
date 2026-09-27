import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const deployScript = path.resolve(import.meta.dir, '../bin/deploy');
const temporaryRoot = path.resolve(import.meta.dir, '../tmp');
const fixtures = [];

afterEach(() => {
  for (const directory of fixtures.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
}

function fixture() {
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'deploy-test-'));
  fixtures.push(directory);
  const root = path.join(directory, 'repo');
  const remote = path.join(directory, 'origin.git');
  fs.mkdirSync(root);
  fs.mkdirSync(remote);
  git(remote, 'init', '--bare', '--initial-branch=main');
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.name', 'Deploy Test');
  git(root, 'config', 'user.email', 'deploy-test@example.invalid');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'config', 'core.hooksPath', '/dev/null');
  git(root, 'remote', 'add', 'origin', remote);
  fs.writeFileSync(path.join(root, '.gitignore'), 'dist/\ntmp/\n');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'deploy-test',
        version: '0.7.9',
        scripts: { build: 'bun build.js', static: 'bun site.js' },
      },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(
    path.join(root, 'build.js'),
    `
import fs from 'node:fs';
if (process.env.DEPLOY_TEST_FAIL === 'build') process.exit(1);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/fez.js', JSON.parse(fs.readFileSync('package.json')).version);
`,
  );
  fs.writeFileSync(
    path.join(root, 'site.js'),
    `
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
if (process.env.DEPLOY_TEST_FAIL === 'site') process.exit(1);
fs.mkdirSync('tmp/fez-pages', { recursive: true });
fs.writeFileSync('tmp/fez-pages/index.html', fs.readFileSync('dist/fez.js'));
if (process.env.DEPLOY_TEST_RACE) {
  const remote = process.env.DEPLOY_TEST_RACE;
  const commit = execFileSync('git', ['-C', remote,
    '-c', 'user.name=Other Publisher', '-c', 'user.email=other@example.invalid',
    'commit-tree', 'pages^{tree}', '-p', 'pages', '-m', 'Concurrent deployment'],
    { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', remote, 'update-ref', 'refs/heads/pages', commit]);
}
`,
  );
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'Initial source');
  git(root, 'push', 'origin', 'main');
  return { root, remote };
}

function deploy(root, args = [], env = {}) {
  return Bun.spawnSync([process.execPath, deployScript, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

function version(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

function stamp(root) {
  const file = path.join(root, '.version');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

test('deploy versions by main commit count, commits main, creates then amends pages, and pushes both', () => {
  const { root, remote } = fixture();
  // one source commit, then each release commit counts toward its own version
  for (const expected of ['0.0.2', '0.0.3']) {
    const result = deploy(root);
    expect(result.stderr.toString()).not.toContain('deploy:');
    expect(result.exitCode).toBe(0);
    expect(version(root)).toBe(expected);
    expect(stamp(root)).toBe(`v${git(root, 'rev-list', '--count', 'main')}`);
    expect(git(remote, 'show', 'main:.version')).toBe(stamp(root));
    expect(fs.readFileSync(path.join(root, 'dist/fez.js'), 'utf8')).toBe(expected);
    expect(git(remote, 'show', 'pages:index.html')).toBe(expected);
    expect(git(remote, 'log', '-1', '--format=%s', 'main')).toBe(`chore: release ${expected}`);
    const mainSha = git(root, 'rev-parse', '--short', 'main');
    expect(git(remote, 'log', '-1', '--format=%s', 'pages')).toBe(
      `fez-pages ${expected} (${mainSha})`,
    );
    expect(git(remote, 'rev-list', '--count', 'pages')).toBe('1');
    expect(git(remote, 'rev-parse', 'main')).toBe(git(root, 'rev-parse', 'main'));
    expect(git(root, 'status', '--porcelain')).toBe('');
  }
});

test('a long history splits the commit count into a.b.c', () => {
  const { root } = fixture();
  for (let i = 0; i < 122; i++) git(root, 'commit', '--allow-empty', '-m', `Change ${i}`);
  git(root, 'push', 'origin', 'main');
  // 123 source commits + the release commit
  expect(deploy(root).exitCode).toBe(0);
  expect(version(root)).toBe('1.2.4');
  expect(stamp(root)).toBe('v124');
  expect(git(root, 'rev-list', '--count', 'main')).toBe('124');
});

test('dry-run previews the new version but preserves source and all Git refs', () => {
  const { root, remote } = fixture();
  const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const localRefs = git(root, 'show-ref');
  const remoteRefs = git(remote, 'show-ref');
  const result = deploy(root, ['--dry-run']);
  expect(result.exitCode).toBe(0);
  expect(fs.readFileSync(path.join(root, 'tmp/fez-pages/index.html'), 'utf8')).toBe('0.0.2');
  expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toBe(manifest);
  expect(stamp(root)).toBe(null);
  expect(git(root, 'show-ref')).toBe(localRefs);
  expect(git(remote, 'show-ref')).toBe(remoteRefs);
  expect(fs.existsSync(path.join(root, 'tmp/pages-wt'))).toBe(false);
  expect(git(root, 'status', '--porcelain')).toBe('');
});

for (const stage of ['build', 'site']) {
  test(`${stage} failure restores the version and does not commit or push`, () => {
    const { root, remote } = fixture();
    const before = git(root, 'rev-parse', 'HEAD');
    const result = deploy(root, [], { DEPLOY_TEST_FAIL: stage });
    expect(result.exitCode).toBe(1);
    expect(version(root)).toBe('0.7.9');
    expect(stamp(root)).toBe(null);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(remote, 'rev-parse', 'main')).toBe(before);
    expect(git(root, 'status', '--porcelain')).toBe('');
  });
}

test('deploy refuses dirty source and leaves changes intact', () => {
  const { root } = fixture();
  fs.writeFileSync(path.join(root, 'notes.txt'), 'Uncommitted work\n');
  const result = deploy(root);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('main must be clean');
  expect(version(root)).toBe('0.7.9');
  expect(fs.readFileSync(path.join(root, 'notes.txt'), 'utf8')).toBe('Uncommitted work\n');
});

test('deploy refuses changes in the existing pages worktree before bumping', () => {
  const { root } = fixture();
  expect(deploy(root).exitCode).toBe(0);
  const output = path.join(root, 'tmp/pages-wt/index.html');
  fs.writeFileSync(output, 'Local edit');
  const result = deploy(root);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('pages worktree has local files or changes');
  expect(version(root)).toBe('0.0.2');
  expect(fs.readFileSync(output, 'utf8')).toBe('Local edit');
});

test('a concurrent remote Pages update rejects the atomic push without publishing main', () => {
  const { root, remote } = fixture();
  expect(deploy(root).exitCode).toBe(0);
  const remoteMain = git(remote, 'rev-parse', 'main');
  const result = deploy(root, [], { DEPLOY_TEST_RACE: remote });
  expect(result.exitCode).toBe(1);
  expect(git(remote, 'rev-parse', 'main')).toBe(remoteMain);
  expect(git(remote, 'log', '-1', '--format=%s', 'pages')).toBe('Concurrent deployment');
  expect(version(root)).toBe('0.0.3');
  expect(git(root, 'log', '-1', '--format=%s')).toBe('chore: release 0.0.3');
});

test('help describes all deployment steps without touching the repository', () => {
  const result = deploy(process.cwd(), ['--help']);
  expect(result.exitCode).toBe(0);
  for (const phrase of [
    'main commit count',
    'library and pages',
    'commit the version on main',
    'amend or create',
    'push both branches',
  ]) {
    expect(result.stdout.toString()).toContain(phrase);
  }
});
