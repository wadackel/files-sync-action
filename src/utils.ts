import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepmerge } from 'deepmerge-ts';
import type { PartialDeep, Simplify } from 'type-fest';

/**
 * Modules
 */
export const filename = (url: string): string => fileURLToPath(url);

export const dirname = (url: string): string => path.dirname(filename(url));

/**
 * Objects
 */
export const merge = <T, U>(x: PartialDeep<T>, y: PartialDeep<U>): Simplify<T & U> => {
  return deepmerge(x, y) as T & U;
};

/**
 * Git
 */
export const convertValidBranchName = (input: string): string => {
  let b = input.trim();
  b = b.replace(/^[./]+/, ''); // remove prefix '.' or '/'
  b = b.replace(/[/]+/g, '-'); // convert '/' to '-'
  b = b.replace(/[@{\\~^:?*[\]]+/g, ''); // remove invalid character
  b = b.replace(/[.]+$/, ''); // remove "." at the end of string
  return b;
};

export const splitCommitMessage = (message: string): { headline: string; body: string | null } => {
  const dividerIdx = message.indexOf('\n');
  const hasBody = dividerIdx !== -1;
  const headline = hasBody ? message.slice(0, dividerIdx) : message;
  const body = hasBody ? message.slice(dividerIdx + 1) : null;
  return { headline, body };
};
