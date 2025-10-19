import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as TE from 'fp-ts/TaskEither';
import * as YAML from 'yaml';
import { ZodError, z } from 'zod';
import { fromZodError } from 'zod-validation-error';

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

export const MergeMode = z.enum(['disabled', 'immediate', 'auto', 'admin']);
export type MergeMode = z.infer<typeof MergeMode>;

export const MergeStrategy = z.enum(['merge', 'rebase', 'squash']);
export type MergeStrategy = z.infer<typeof MergeStrategy>;

export const mergeConfigSchema = z
  .object({
    mode: MergeMode,
    strategy: MergeStrategy,
    delete_branch: z.boolean(),
    commit: commitConfigSchema,
  })
  .partial();
export type MergeConfig = z.infer<typeof mergeConfigSchema>;

export const pullRequestConfigSchema = z
  .object({
    disabled: z.boolean(),
    force: z.boolean(),
    title: z.string(),
    body: z.string(),
    reviewers: z.array(z.string()),
    assignees: z.array(z.string()),
    labels: z.array(z.string()),
    merge: mergeConfigSchema,
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

export const deleteFileConfigSchema = z.object({
  path: z.string(),
  type: z.enum(['file', 'directory']),
});
export type DeleteFileConfig = z.infer<typeof deleteFileConfigSchema>;

export const templateConfigSchema = z.record(z.string(), z.any());
export type TemplateConfig = z.infer<typeof templateConfigSchema>;

export const patternConfigSchema = z.object({
  files: z.array(z.union([z.string(), fileConfigSchema])),
  delete_files: z.array(z.union([z.string(), deleteFileConfigSchema])).optional(),
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
    const raw = await (async () => {
      try {
        return await fs.readFile(filepath, 'utf8');
      } catch (e) {
        // Try loading alternative extensions.
        const parts = path.parse(filepath);
        let ext = '';
        switch (parts.ext) {
          case '.yml':
            ext = '.yaml';
            break;
          case '.yaml':
            ext = '.yml';
            break;
          default:
            throw e;
        }
        return await fs.readFile(path.join(parts.dir, parts.name + ext), 'utf8');
      }
    })();
    const yaml = YAML.parse(raw) as unknown;
    return configSchema.parse(yaml);
  },
  (reason) => {
    if (reason instanceof ZodError) {
      return new Error(
        fromZodError(reason, {
          includePath: true,
          prefixSeparator: '\n',
          issueSeparator: '\n',
        }).message,
      );
    } else {
      return new Error(String(reason));
    }
  },
);
