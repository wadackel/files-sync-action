import * as fs from 'node:fs/promises';
import * as TE from 'fp-ts/TaskEither';
import * as YAML from 'yaml';
import { ZodError, z } from 'zod';
import { generateErrorMessage } from 'zod-error';

// Schema
export const commitConfigSchema = z
  .object({
    format: z.string(),
    prefix: z.string(),
    subject: z.string(),
  })
  .partial();
export type CommitConfig = z.infer<typeof commitConfigSchema>;

export const branchConfigSchema = z
  .object({
    format: z.string(),
    prefix: z.string(),
  })
  .partial();
export type BranchConfig = z.infer<typeof branchConfigSchema>;

export const pullRequestConfigSchema = z
  .object({
    disabled: z.boolean(),
    override: z.boolean(),
    title: z.string(),
    body: z.string(),
    reviewers: z.array(z.string()),
    assignees: z.array(z.string()),
    labels: z.array(z.string()),
  })
  .partial();
export type PullRequestConfig = z.infer<typeof pullRequestConfigSchema>;

export const settingsConfigSchema = z
  .object({
    commit: commitConfigSchema,
    branch: branchConfigSchema,
    pull_request: pullRequestConfigSchema,
  })
  .partial();
export type SettingsConfig = z.infer<typeof settingsConfigSchema>;

export const fileConfigSchema = z.object({
  from: z.string(),
  to: z.string(),
  exclude: z.array(z.string()).optional(),
});
export type FileConfig = z.infer<typeof fileConfigSchema>;

export const templateConfigSchema = z.record(z.string(), z.any());
export type TemplateConfig = z.infer<typeof templateConfigSchema>;

export const patternConfigSchema = z.object({
  files: z.array(z.union([z.string(), fileConfigSchema])),
  repositories: z.array(z.string()),
  commit: commitConfigSchema.optional(),
  branch: branchConfigSchema.optional(),
  pull_request: pullRequestConfigSchema.optional(),
  template: templateConfigSchema.optional(),
});
export type PatternConfig = z.infer<typeof patternConfigSchema>;

export const configSchema = z.object({
  settings: settingsConfigSchema.optional(),
  patterns: z.array(patternConfigSchema),
});
export type Config = z.infer<typeof configSchema>;

// Loader
export const loadConfig = TE.tryCatchK(
  async (filepath: string) => {
    const raw = await fs.readFile(filepath, 'utf8');
    const yaml = YAML.parse(raw);
    return configSchema.parse(yaml);
  },
  (reason) => {
    if (reason instanceof ZodError) {
      return new Error(
        generateErrorMessage(reason.issues, {
          code: {
            enabled: false,
          },
          message: {
            enabled: true,
            label: '',
          },
          path: {
            enabled: true,
            type: 'objectNotation',
            label: '',
          },
        }),
      );
    } else {
      return new Error(String(reason));
    }
  },
);
