// Shared GitHub Pages branch plumbing.
//
// Used by `fez gh-pages` and this repository's `bin/deploy` so both publish a
// built directory to the `pages` branch without checking it out.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PAGES_BRANCH = 'pages';

export function git(cwd, args, options = {}) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    const detail = String(error.stderr || error.stdout || '').trim();
    throw new Error(`git ${args[0]} failed${detail ? '\n' + detail : ''}`, { cause: error });
  }
}

export function tryGit(cwd, args, options = {}) {
  try {
    return git(cwd, args, options);
  } catch {
    return null;
  }
}

export function assertPagesNotCheckedOut(root, branch = PAGES_BRANCH) {
  const worktrees = git(root, ['worktree', 'list', '--porcelain']);
  if (worktrees.split('\n').includes(`branch refs/heads/${branch}`)) {
    throw new Error(
      `the '${branch}' branch is checked out in a worktree; remove that worktree before publishing`,
    );
  }
}

export function fetchOrigin(root) {
  git(root, ['fetch', '--prune', 'origin']);
}

export function assertPagesInSync(root, branch = PAGES_BRANCH) {
  const remote = tryGit(root, [
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/remotes/origin/${branch}`,
  ]);
  const local = tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  if (local && remote && local !== remote) {
    throw new Error(
      `local ${branch} differs from origin/${branch}; reconcile it before publishing`,
    );
  }
}

// Commits the contents of `directory` on top of the pages branch without a
// checkout: a throwaway index builds the tree, `commit-tree` writes the commit
// and `update-ref` moves the branch. Never touches the primary working tree.
export function commitPages({ root, directory, message, branch = PAGES_BRANCH }) {
  const directoryGitDir = git(root, ['rev-parse', '--absolute-git-dir']);
  const indexFile = path.join(os.tmpdir(), `fez-pages-${process.pid}-${Date.now()}.index`);
  const env = {
    ...process.env,
    GIT_DIR: directoryGitDir,
    GIT_WORK_TREE: directory,
    GIT_INDEX_FILE: indexFile,
  };

  try {
    // --force so a .gitignore shipped as a site asset cannot hide files
    git(directory, ['add', '--all', '--force'], { env });
    const tree = git(directory, ['write-tree'], { env });

    // Continue the local branch, or the fetched remote when the branch is not
    // local yet (a fresh clone); an orphan commit only when neither exists.
    const local = tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
    const remote = tryGit(root, [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/remotes/origin/${branch}`,
    ]);
    const previous = local || remote;
    const parentArgs = previous ? ['-p', previous] : [];
    const commit = git(root, ['commit-tree', tree, ...parentArgs, '-m', message]);
    git(root, [
      'update-ref',
      '-m',
      'fez pages',
      `refs/heads/${branch}`,
      commit,
      // only guard the update when the local ref already exists
      ...(local ? [local] : []),
    ]);
    return commit;
  } finally {
    fs.rmSync(indexFile, { force: true });
  }
}

export function pagesRefspec(branch = PAGES_BRANCH) {
  return `refs/heads/${branch}:refs/heads/${branch}`;
}

export function pushPages(root, branch = PAGES_BRANCH) {
  git(root, ['push', 'origin', pagesRefspec(branch)]);
}
