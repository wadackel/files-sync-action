import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import * as YAML from 'yaml';
import { z } from 'zod';
import { dirname } from '../src/utils.js';
import dedent from 'ts-dedent';

const actionSchema = z.object({
  inputs: z.record(
    z.string(),
    z.object({
      description: z.string(),
      required: z.boolean().optional(),
      default: z.string().optional(),
    }),
  ),
  outputs: z.record(
    z.string(),
    z.object({
      description: z.string(),
    }),
  ),
});

const edit = (content: string, marker: { start: string; end: string }, additional: string) => {
  const offset = {
    start: content.indexOf(marker.start),
    end: content.indexOf(marker.end),
  };

  if (offset.start < 0 || offset.end < 0) {
    return content;
  }

  const before = content.slice(0, offset.start + marker.start.length);
  const after = content.slice(offset.end);

  return [before, additional, after].join('\n');
};

const run = async () => {
  // action
  const __dirname = dirname(import.meta.url);
  const raw = await fs.readFile(path.join(__dirname, '../action.yml'), 'utf8');
  const action = YAML.parse(raw);
  const { inputs, outputs } = actionSchema.parse(action);

  // readme
  const readme = {
    path: path.join(__dirname, '../README.md'),
    content: '',
  };
  readme.content = await fs.readFile(readme.path, 'utf8');

  // inputs
  readme.content = edit(
    readme.content,
    {
      start: '<!-- inputs-start -->',
      end: '<!-- inputs-end -->',
    },
    Object.entries(inputs)
      .map(([name, meta]) => {
        const required = meta.required === true ? '`true`' : '`false`';
        const value = meta.default !== undefined ? `\`${meta.default}\`` : 'n/a';
        return [
          `### \`${name}\``,
          '',
          `**Required:** ${required}  `,
          `**Default:** ${value}`,
          '',
          meta.description,
        ].join('\n');
      })
      .join('\n\n'),
  );

  // outputs
  readme.content = edit(
    readme.content,
    {
      start: '<!-- outputs-start -->',
      end: '<!-- outputs-end -->',
    },
    Object.entries(outputs)
      .map(([name, meta]) => {
        return [`### \`${name}\``, '', meta.description].join('\n');
      })
      .join('\n\n'),
  );

  // save
  await fs.writeFile(readme.path, readme.content, 'utf8');
};

try {
  await run();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
