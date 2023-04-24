// NOTE: This is auto-generated file.
import * as core from '@actions/core';

const keys: [key: string, required: boolean][] = [
  ['github_token', true],
  ['github_api_url', true],
  ['config_file', true],
];

export type Inputs = {
  github_token: string;
  github_api_url: string;
  config_file: string;
};

export const getInputs = (): Inputs => {
  const inputs: any = Object.create(null);
  for (const [key, required] of keys) {
    const v = core.getInput(key);
    inputs[key] = !required && v === '' ? null : v;
  }
  return inputs;
};
