import { expect, test } from 'vitest';
import { convertValidBranchName } from './utils.js';

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
