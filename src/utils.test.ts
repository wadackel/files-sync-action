import { expect, test } from 'vitest';
import { convertValidBranchName, merge, splitCommitMessage } from './utils.js';

test.each([
  ['foo', 'foo'],
  ['foo-bar', 'foo-bar'],
  ['foo/bar', 'foo-bar'],
  ['foo//bar', 'foo-bar'],
  ['/foo', 'foo'],
  ['.foo', 'foo'],
  ['@{foo', 'foo'],
  ['foo\\bar', 'foobar'],
  ['foo~bar', 'foobar'],
  ['foo^bar', 'foobar'],
  ['foo:bar', 'foobar'],
  ['foo?bar', 'foobar'],
  ['foo*bar', 'foobar'],
  ['foo[]bar', 'foobar'],
  ['foo.', 'foo'],
])('convertValidBranchName', (input, expected) => {
  expect(convertValidBranchName(input)).toBe(expected);
});

test.each([
  [
    'lists inherited from settings are concatenated, not replaced',
    { pull_request: { labels: ['files-sync'] } },
    { pull_request: { labels: ['A-build'] } },
    { pull_request: { labels: ['files-sync', 'A-build'] } },
  ],
  [
    'an empty list does not clear the inherited entries',
    { pull_request: { reviewers: ['wadackel'] } },
    { pull_request: { reviewers: [] } },
    { pull_request: { reviewers: ['wadackel'] } },
  ],
  [
    'a scalar is overridden by the pattern',
    { commit: { prefix: 'chore', format: '<%- prefix %>' } },
    { commit: { prefix: 'feat' } },
    { commit: { prefix: 'feat', format: '<%- prefix %>' } },
  ],
  [
    'keys absent from settings are added',
    { branch: { prefix: 'files-sync' } },
    { branch: { format: '<%- prefix %>' } },
    { branch: { prefix: 'files-sync', format: '<%- prefix %>' } },
  ],
])('merge: %s', (_name, settings, pattern, expected) => {
  expect(merge(settings as never, pattern as never)).toEqual(expected);
});

test.each([
  ['headline only', 'chore: sync files', { headline: 'chore: sync files', body: null }],
  ['headline and body', 'chore: sync\n\ndetails', { headline: 'chore: sync', body: '\ndetails' }],
])('splitCommitMessage: %s', (_name, input, expected) => {
  expect(splitCommitMessage(input)).toEqual(expected);
});
