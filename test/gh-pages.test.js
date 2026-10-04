import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ghPages = path.resolve(import.meta.dir, '../bin/fez-gh-pages');
const temporaryRoot = path.resolve(import.meta.dir, '../tmp');
const fixtures = [];

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
}

function fixture({ remote = true } = {}) {
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'gh-pages-test-'));
  fixtures.push(directory);
  const root = path.join(directory, 'repo');
  fs.mkdirSync(path.join(root, 'pages_src/root'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages_src/layouts'), { recursive: true });
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.name', 'Pages Test');
  git(root, 'config', 'user.email', 'pages-test@example.invalid');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'config', 'core.hooksPath', '/dev/null');

  let remoteDir = null;
  if (remote) {
    remoteDir = path.join(directory, 'origin.git');
    fs.mkdirSync(remoteDir);
    git(remoteDir, 'init', '--bare', '--initial-branch=main');
    git(root, 'remote', 'add', 'origin', remoteDir);
  }

  fs.writeFileSync(path.join(root, '.gitignore'), 'tmp/\n');
  fs.writeFileSync(
    path.join(root, 'fez-static.yaml'),
    'source_dir: pages_src\ntarget_dir: tmp/site\n',
  );
  fs.writeFileSync(
    path.join(root, 'pages_src/layouts/default.html'),
    '<!doctype html>\n<html><body>{@content}</body></html>\n',
  );
  fs.writeFileSync(path.join(root, 'pages_src/root/index.html'), '<h1>Hello</h1>\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'Initial source');
  if (remoteDir) {
    git(root, 'push', 'origin', 'main');
  }
  return { root, remote: remoteDir };
}

function run(root, args = []) {
  return Bun.spawnSync([process.execPath, ghPages, ...args], {
    cwd: root,
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

describe('fez gh-pages', () => {
  test('commits the built site to the pages branch and pushes it', () => {
    const { root, remote } = fixture();
    const result = run(root);

    expect(result.stderr.toString()).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('fez gh-pages: built');
    expect(git(remote, 'show', 'pages:index.html')).toContain('Hello');
    expect(git(root, 'rev-list', '--count', 'pages')).toBe('1');
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(git(root, 'worktree', 'list').split('\n').length).toBe(1);
  });

  test('appends each publish as a new commit and fast-forwards the remote', () => {
    const { root, remote } = fixture();
    expect(run(root).exitCode).toBe(0);

    fs.writeFileSync(path.join(root, 'pages_src/root/index.html'), '<h1>Updated</h1>\n');
    const result = run(root);

    expect(result.exitCode).toBe(0);
    expect(git(root, 'rev-list', '--count', 'pages')).toBe('2');
    expect(git(remote, 'rev-list', '--count', 'pages')).toBe('2');
    expect(git(remote, 'show', 'pages:index.html')).toContain('Updated');
    expect(git(root, 'rev-parse', 'pages')).toBe(git(remote, 'rev-parse', 'pages'));
  });

  test('fast-forwards a fresh clone where only origin/pages exists', () => {
    const { root, remote } = fixture();
    expect(run(root).exitCode).toBe(0);

    // a fresh clone has origin/pages but no local pages branch
    git(root, 'update-ref', '-d', 'refs/heads/pages');
    fs.writeFileSync(path.join(root, 'pages_src/root/index.html'), '<h1>Clone</h1>\n');
    const result = run(root);

    expect(result.exitCode).toBe(0);
    expect(git(remote, 'rev-list', '--count', 'pages')).toBe('2');
    expect(git(remote, 'show', 'pages:index.html')).toContain('Clone');
  });

  test('refuses to publish when local pages has diverged from origin', () => {
    const { root, remote } = fixture();
    expect(run(root).exitCode).toBe(0);

    // another publisher moves origin/pages without this clone knowing
    const other = path.join(root, '..', 'other');
    git(root, 'clone', '--branch', 'pages', remote, other);
    git(other, 'config', 'user.name', 'Other');
    git(other, 'config', 'user.email', 'other@example.invalid');
    git(other, 'commit', '--allow-empty', '-m', 'Concurrent publish');
    git(other, 'push', 'origin', 'pages');

    const result = run(root);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('local pages differs from origin/pages');
  });

  test('--no-push commits locally without an origin remote', () => {
    const { root } = fixture({ remote: false });
    const result = run(root, ['--no-push']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('skipped push (--no-push)');
    expect(git(root, 'show', 'pages:index.html')).toContain('Hello');
  });

  test('refuses to push without an origin remote', () => {
    const { root } = fixture({ remote: false });
    const result = run(root);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("no 'origin' remote");
  });

  test('refuses to publish while the pages branch is checked out in a worktree', () => {
    const { root, remote } = fixture();
    const tree = path.join(root, 'tmp/wt');
    fs.mkdirSync(path.dirname(tree), { recursive: true });
    git(root, 'worktree', 'add', '-b', 'pages', tree, 'main');

    const before = git(root, 'rev-parse', 'pages');
    const result = run(root);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("'pages' branch is checked out");
    // the pre-existing worktree is untouched
    expect(git(root, 'rev-parse', 'pages')).toBe(before);
    expect(fs.existsSync(path.join(tree, 'pages_src'))).toBe(true);
    expect(git(root, 'worktree', 'list').split('\n').length).toBe(2);
  });

  test('fails cleanly outside a Git repository', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-test-'));
    fixtures.push(directory);
    const result = run(directory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('not inside a Git repository');
    expect(result.stderr.toString()).not.toContain('TypeError');
  });

  test('help describes publishing, preview, and push options', () => {
    const result = run(process.cwd(), ['--help']);

    expect(result.exitCode).toBe(0);
    for (const phrase of ['fez gh-pages', '--serve', '--no-push', '--drafts', 'pages']) {
      expect(result.stdout.toString()).toContain(phrase);
    }
  });

  test('reports unknown options cleanly', () => {
    const result = run(process.cwd(), ['--nope']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Unknown option '--nope'");
    expect(result.stderr.toString()).not.toContain('Bun v');
  });

  test('-s serves the target and rebuilds on change', async () => {
    const { root } = fixture({ remote: false });
    const port = 8600 + Math.floor(Math.random() * 1000);
    const child = Bun.spawn({
      cmd: [process.execPath, ghPages, '--no-push', '-s', '--port', String(port)],
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    try {
      const output = await readUntil(child.stdout, `127.0.0.1:${port}/`);
      expect(output).toContain('fez gh-pages: serving');
      expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain('Hello');

      fs.writeFileSync(path.join(root, 'pages_src/root/index.html'), '<h1>Live</h1>\n');
      let body = '';
      for (let attempt = 0; attempt < 50; attempt++) {
        await Bun.sleep(100);
        body = await (await fetch(`http://127.0.0.1:${port}/`)).text();
        if (body.includes('Live')) {
          break;
        }
      }
      expect(body).toContain('Live');
    } finally {
      child.kill('SIGKILL');
      await child.exited;
    }
  });
});

async function readUntil(stream, marker, timeoutMs = 15000) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  const deadline = Date.now() + timeoutMs;
  let buffer = '';
  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes(marker)) {
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return buffer;
}
