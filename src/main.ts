import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as core from '@actions/core';
import { render } from 'ejs';
import glob from 'fast-glob';
import * as A from 'fp-ts/Array';
import * as T from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import mm from 'micromatch';
import { loadConfig } from './config.js';
import {
  GH_REPOSITORY,
  GH_RUN_ID,
  GH_RUN_NUMBER,
  GH_SERVER,
  GH_WORKFLOW,
  PR_FOOTER,
  defaultEntryConfig,
  defaultFile,
} from './constants.js';
import { createGitHub } from './github.js';
import { getInputs } from './inputs.js';
import { convertValidBranchName, merge } from './utils.js';

const json = (input: unknown) => JSON.stringify(input, null, '  ');
const info = (key: string, value: string) => core.info(`${key.padStart(21)}: ${value}`);

const getValidInputs = T.tryCatchK(
  () => {
    const inputs = getInputs();

    if (inputs.github_token === null) {
      if (
        inputs.github_app_id === null ||
        inputs.github_app_installation_id === null ||
        inputs.github_app_private_key === null
      ) {
        throw new Error('"GITHUB_TOKEN" or "GITHUB_APP_*" is required, but not specified in "inputs" field.');
      }
    } else {
      if (
        inputs.github_app_id !== null ||
        inputs.github_app_installation_id !== null ||
        inputs.github_app_private_key !== null
      ) {
        throw new Error('If "GITHUB_TOKEN" is specified, "GITHUB_APP_*" cannot be specified.');
      }
    }

    return inputs;
  },
  (error) => new Error(String(error)),
);

const run = async (): Promise<number> => {
  const cwd = process.cwd();

  const inputs = getValidInputs();
  if (T.isLeft(inputs)) {
    core.setFailed(inputs.left.message);
    return 1;
  }

  const config = await loadConfig(inputs.right.config_file)();
  if (T.isLeft(config)) {
    core.setFailed(`Load config error: ${inputs.right.config_file}#${config.left.message}`);
    return 1;
  }
  core.debug(`config: ${json(config.right)}`);

  const settings = config.right.settings;
  const github = createGitHub(inputs.right);
  const prUrls = new Set<string>();
  const syncedFiles = new Set<string>();

  for (const [i, entry] of config.right.patterns.entries()) {
    core.info('	');

    const cfg = merge(
      defaultEntryConfig,
      merge(
        {
          commit: settings?.commit ?? {},
          branch: settings?.branch ?? {},
          pull_request: settings?.pull_request ?? {},
        },
        {
          commit: entry.commit ?? {},
          branch: entry.branch ?? {},
          pull_request: entry.pull_request ?? {},
        },
      ),
    );

    core.debug(`patterns.${i} - merged config: ${json(cfg)}`);

    // Resolve files
    const files = await pipe(
      entry.files.map((f, j) => {
        const id = `patterns.${i}.files.${j}`;

        return TE.tryCatch(
          async () => {
            const file =
              typeof f === 'string'
                ? {
                    ...defaultFile,
                    from: f,
                    to: f,
                  }
                : {
                    ...f,
                    exclude: f.exclude ?? defaultFile.exclude,
                  };

            const filepath = path.resolve(cwd, file.from);
            const stat = await fs.stat(filepath);
            let paths: [from: string, to: string][];

            if (stat.isDirectory()) {
              const list = await glob('**/*', {
                absolute: false,
                onlyFiles: true,
                cwd: path.join(cwd, file.from),
              });
              paths = list.map((p) => [path.join(file.from, p), path.join(file.to, p)]);
              if (file.exclude.length > 0) {
                paths = paths.filter(([from]) => file.exclude.every((e) => !mm.isMatch(from, path.join(file.from, e))));
              }
            } else {
              paths = [[file.from, file.to]];
              if (file.exclude.length > 0) {
                core.warning(`${id} - "exclude" specified for "${file.from}" was ignored because it is a single file.`);
              }
            }

            return await Promise.all(
              paths.map(async ([from, to]) => {
                const raw = await fs.readFile(path.join(cwd, from), 'utf8');
                const content = entry.template !== undefined ? render(raw, entry.template) : raw;
                return {
                  from,
                  to,
                  content,
                };
              }),
            );
          },
          (reason) => new Error(`${id} - File resolve error: ${reason}`),
        );
      }),
      A.sequence(TE.ApplicativePar),
      TE.map(A.flatten),
    )();

    if (T.isLeft(files)) {
      core.setFailed(files.left.message);
      return 1;
    }

    core.debug(`patterns.${i} - files:`);
    for (const file of files.right) {
      core.debug(`  - from "${file.from}" to "${file.to}"`);
    }

    // Commit to repository
    core.info(`Synchronize ${files.right.length} files:`);

    for (const name of entry.repositories) {
      core.info('	');

      const id = `patterns.${i}#${name}`;

      const repository = await github.initializeRepository(name)();
      if (T.isLeft(repository)) {
        core.setFailed(`${id} - Repository initializing error: ${repository.left.message}`);
        return 1;
      }

      const repo = repository.right;

      const branch = render(cfg.branch.format, {
        prefix: cfg.branch.prefix,
        repository: convertValidBranchName(GH_REPOSITORY),
        index: i,
      });

      info('Repository', name);
      info('Branch', branch);

      // Find existing PR
      const existingPr = await repo.findExistingPullRequestByBranch(branch)();
      if (T.isLeft(existingPr)) {
        core.setFailed(`${id} - Find existing pull request error: ${existingPr.left.message}`);
        return 1;
      }
      core.debug(`existing pull request: ${json(existingPr.right)}`);

      // Get parent SHA
      let parent: string;
      if (existingPr.right !== null) {
        parent = existingPr.right.base.sha;
        info('Existing Pull Request', existingPr.right.html_url);
      } else {
        const b = await repo.createBranch(branch)();
        if (T.isLeft(b)) {
          core.setFailed(`${id} - Create branch error: ${b.left.message}`);
          return 1;
        }
        parent = b.right.sha;
      }
      info('Branch SHA', parent);

      // Commit files
      const commit = await repo.commit({
        parent,
        branch,
        message: render(cfg.commit.format, {
          prefix: cfg.commit.prefix,
          subject: render(cfg.commit.subject, {
            repository: GH_REPOSITORY,
            index: i,
          }),
          repository: GH_REPOSITORY,
          index: i,
        }),
        files: files.right.map((file) => ({
          path: file.to,
          content: file.content,
        })),
      })();
      if (T.isLeft(commit)) {
        core.setFailed(`${id} - ${commit.left.message}`);
        return 1;
      }
      core.debug(`commit: ${json(commit.right)}`);
      info('Commit', commit.right.sha);
      info('Commit SHA', commit.right.message);

      const diff = await repo.compareCommits(parent, commit.right.sha)();
      if (T.isLeft(diff)) {
        core.setFailed(`${id} - Compare commits error: ${diff.left.message}`);
        return 1;
      }
      core.debug(`diff: ${json(diff.right)}`);
      info('Changed Files', String(diff.right.length));

      // If there are no differences, the existing PR is close and the branch is delete.
      if (diff.right.length === 0) {
        info('Status', 'Skipping this process because the pull request already exists.');

        if (existingPr.right !== null) {
          const res = await repo.closePullRequest(existingPr.right.number)();
          if (T.isLeft(res)) {
            core.setFailed(`${id} - Close pull request error: ${res.left.message}`);
            return 1;
          }
          core.debug(`${name}: #${existingPr.right.number} closed`);
        }

        const res = await repo.deleteBranch(branch)();
        if (T.isLeft(res)) {
          core.setFailed(`${id} - Delete branch error: ${res.left.message}`);
          return 1;
        }
        core.debug(`${name}: branch "${branch}" deleted`);
        continue;
      }

      // Create Pull Request
      const pr = await repo.createOrUpdatePullRequest({
        number: existingPr.right?.number ?? null,
        title: render(cfg.pull_request.title, {
          repository: GH_REPOSITORY,
          index: i,
        }),
        body: render([cfg.pull_request.body, PR_FOOTER].join('\n'), {
          github: GH_SERVER,
          repository: GH_REPOSITORY,
          workflow: GH_WORKFLOW,
          run: {
            id: GH_RUN_ID,
            number: GH_RUN_NUMBER,
            url: `${GH_SERVER}/${GH_REPOSITORY}/actions/runs/${GH_RUN_ID}`,
          },
          changes: diff.right.map((d) => ({
            from: files.right.find((f) => f.to === d.filename)?.from,
            to: d.filename,
          })),
          index: i,
        }),
        branch,
      })();
      if (T.isLeft(pr)) {
        core.setFailed(`${id} - Create(Update) pull request error: ${pr.left.message}`);
        return 1;
      }
      core.debug(`pull request: ${json(pr)}`);
      info('Pull Request', `#${pr.right.number} - ${pr.right.html_url}`);

      // Add labels
      if (cfg.pull_request.labels.length > 0) {
        const res = await repo.addPullRequestLabels(pr.right.number, cfg.pull_request.labels)();
        if (T.isLeft(res)) {
          core.setFailed(`${id} - Add labels error: ${res.left.message}`);
          return 1;
        }
        info('Labels', cfg.pull_request.labels.join(', '));
      } else {
        info('Labels', 'None');
      }

      // Add reviewers
      if (cfg.pull_request.reviewers.length > 0) {
        const res = await repo.addPullRequestReviewers(pr.right.number, cfg.pull_request.reviewers)();
        if (T.isLeft(res)) {
          core.setFailed(`${id} - Add reviewers error: ${res.left.message}`);
          return 1;
        }
        info('Reviewers', cfg.pull_request.reviewers.join(', '));
      } else {
        info('Reviewers', 'None');
      }

      // Add assignees
      if (cfg.pull_request.assignees.length > 0) {
        const res = await repo.addPullRequestAssignees(pr.right.number, cfg.pull_request.assignees)();
        if (T.isLeft(res)) {
          core.setFailed(`${id} - Add assignees error: ${res.left.message}`);
          return 1;
        }
        info('Assignees', cfg.pull_request.assignees.join(', '));
      } else {
        info('Assignees', 'None');
      }

      info('Status', 'Complete');

      // Set ouptut values
      prUrls.add(pr.right.html_url);

      for (const { filename } of diff.right) {
        syncedFiles.add(filename);
      }
    }
  }

  core.setOutput('pull_request_urls', [...prUrls]);
  core.setOutput('synced_files', [...syncedFiles]);

  return 0;
};

try {
  const code = await run();
  process.exit(code);
} catch (e) {
  core.setFailed(e as Error);
  process.exit(1);
}
