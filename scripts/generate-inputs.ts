import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import * as YAML from 'yaml';
import { z } from 'zod';
import { dirname } from '../src/utils.js';

const actionSchema = z.object({
  inputs: z.record(
    z.string(),
    z
      .object({
        required: z.boolean(),
        default: z.string(),
      })
      .partial(),
  ),
});

const run = async () => {
  // action
  const __dirname = dirname(import.meta.url);
  const raw = await fs.readFile(path.join(__dirname, '../action.yml'), 'utf8');
  const action = YAML.parse(raw);
  const { inputs } = actionSchema.parse(action);

  // source
  const project = new Project();
  const source = project.createSourceFile(
    path.join(__dirname, '../src/inputs.ts'),
    `
// NOTE: This is auto-generated file.
import * as core from '@actions/core';

const keys: [key: string, required: boolean][] = [];

export type Inputs = {};

export const getInputs = (): Inputs => {
  const inputs: any = Object.create(null);
  for (const [key, required] of keys) {
    const v = core.getInput(key);
    inputs[key] = !required && v === '' ? null : v;
  }
  return inputs;
};
    `,
    {
      overwrite: true,
    },
  );

  // keys
  const keys = source.getVariableDeclarationOrThrow('keys');
  keys.setInitializer((writer) => {
    writer.write('[');
    for (const [key, meta] of Object.entries(inputs)) {
      const required = meta.default !== undefined || meta.required === true;
      writer.writeLine(`['${key}', ${required}],`);
    }
    writer.write(']');
  });

  // type alias
  const type = source.getTypeAliasOrThrow('Inputs');
  type.setType((writer) => {
    writer.write('{');
    for (const [key, meta] of Object.entries(inputs)) {
      const required = meta.default !== undefined || meta.required === true;
      const type = required ? 'string' : 'string | null';
      writer.writeLine(`${key}: ${type};`);
    }
    writer.write('}');
  });

  // save file
  await source.save();
};

try {
  await run();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
