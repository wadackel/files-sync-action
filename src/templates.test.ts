import path from 'node:path';
import { render } from 'ejs';
import mm from 'micromatch';
import * as T from 'fp-ts/Either';
import { expect, test } from 'vitest';
import { loadConfig } from './config.js';
import { defaultEntryConfig } from './constants.js';

const repository = 'owner/repo';
const index = 0;

const subject = render(defaultEntryConfig.commit.subject, { repository, index });

test('commit.subject renders the repository name', () => {
  expect(subject).toBe('sync files with `owner/repo`');
});

test('commit.format composes the prefix and the rendered subject', () => {
  const message = render(defaultEntryConfig.commit.format, {
    prefix: defaultEntryConfig.commit.prefix,
    subject,
    repository,
    index,
  });
  expect(message).toBe('chore: sync files with `owner/repo`');
});

test('branch.format renders the prefix, repository and index', () => {
  const branch = render(defaultEntryConfig.branch.format, {
    prefix: defaultEntryConfig.branch.prefix,
    repository,
    index,
  });
  expect(branch).toBe('files-sync/owner/repo-0');
});

test('pull_request.title renders the repository name', () => {
  expect(render(defaultEntryConfig.pull_request.title, { repository, index })).toBe('Sync files with `owner/repo`');
});

test('pull_request.body renders both file lists with whitespace control', () => {
  const body = render(defaultEntryConfig.pull_request.body, {
    github: 'https://github.com',
    repository,
    workflow: 'Sync Files',
    run: { id: '1', number: '2', url: 'https://github.com/owner/repo/actions/runs/1' },
    changes: [
      { from: 'tsconfig.json', to: 'tsconfig.json' },
      { from: 'workflows/ci.yaml', to: '.github/workflows/ci.yaml' },
    ],
    deleted: [{ path: 'obsolete.md' }],
    index,
  });

  expect(body).toBe(
    [
      'This PR contains the following updates:',
      '',
      '| :chart_with_upwards_trend: Change | :hammer_and_wrench: Synchronizing Repository | :link: Workflow |',
      '| :-- | :-- | :-- |',
      '| 2 files | [owner/repo](https://github.com/owner/repo) | [`Sync Files#2`](https://github.com/owner/repo/actions/runs/1) |',
      '',
      '---',
      '',
      '### Modified Files',
      '',
      '- `tsconfig.json`',
      '- `workflows/ci.yaml` to `.github/workflows/ci.yaml`',
      '',
      '### Deleted Files',
      '',
      '- `obsolete.md`',
      '',
    ].join('\n'),
  );
});

test('render returns a string rather than a promise', () => {
  expect(typeof render(defaultEntryConfig.pull_request.title, { repository, index })).toBe('string');
});

test('a template renders values reached through a nested property', () => {
  expect(render('# <%- repository.name %>', { repository: { name: 'owner/repo' } })).toBe('# owner/repo');
});

// Mirrors the exclusion applied in src/main.ts, where each pattern is joined onto `from`.
const exclude = (from: string, patterns: string[], paths: string[]): string[] =>
  paths.filter((p) => patterns.every((e) => !mm.isMatch(p, path.join(from, e))));

test.each([
  ['a top-level glob leaves nested files in place', ['*.txt'], ['dir/sub/b.txt', 'dir/c.js']],
  ['a recursive glob removes nested files too', ['**/*.txt'], ['dir/c.js']],
  ['an unmatched glob removes nothing', ['*.md'], ['dir/a.txt', 'dir/sub/b.txt', 'dir/c.js']],
])('exclude: %s', (_name, patterns, expected) => {
  expect(exclude('dir', patterns, ['dir/a.txt', 'dir/sub/b.txt', 'dir/c.js'])).toEqual(expected);
});

test('the end-to-end fixture config parses into the documented shape', async () => {
  const config = await loadConfig('.github/files-sync-e2e-config.yaml')();
  expect(T.isRight(config)).toBe(true);
  if (!T.isRight(config)) {
    return;
  }
  const pattern = config.right.patterns[0]!;
  expect(pattern.repositories).toEqual(['wadackel/files-sync-action-sandbox1', 'wadackel/files-sync-action-sandbox2']);
  expect(pattern.files).toContainEqual({ from: '.github/fixtures/shared', to: 'files', exclude: ['*.txt'] });
  expect(pattern.template).toEqual({
    repository: { name: 'wadackel/files-sync-action', url: 'https://github.com/wadackel/files-sync-action' },
  });
});
