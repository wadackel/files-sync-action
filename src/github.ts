import * as T from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { getOctokit } from '@actions/github';
import type { Inputs } from './inputs.js';

const handleErrorReason = (reason: unknown) => new Error(String(reason));

const removeAtMark = (input: string) => input.replace(/^@/, '');

const parseRepositoryName = (
  name: string,
): T.Either<Error, [owner: string, repo: string, branch: string | undefined]> => {
  const [fullName = '', branch] = name.split('@');
  const [owner, repo] = fullName.split('/');

  if (!owner || !repo) {
    return T.left(new Error(`Repository name must be in the "owner/repo" format. ("${name}" is an invalid format)`));
  }
  return T.right([owner, repo, branch]);
};

export type Repository = {
  default_branch: string;
};

export type PullRequest = {
  number: number;
  base: {
    sha: string;
  };
  head: {
    sha: string;
  };
  html_url: string;
};

export type Branch = {
  name: string;
  sha: string;
};

export type Commit = {
  message: string;
  sha: string;
};

export type CommitFileMode = '100644' | '100755' | '040000' | '160000' | '120000';

export type CommitFile = {
  path: string;
  mode: CommitFileMode;
  content: string;
};

export type CommitDiffEntry = {
  filename: string;
};

export type GitHubRepositoryCommitParams = {
  parent: string;
  branch: string;
  files: CommitFile[];
  message: string;
  force: boolean;
};

export type GitHubRepositoryCreateOrUpdatePullRequestParams = {
  title: string;
  body: string;
  number?: number | null;
  branch: string;
};

export type GitHubRepository = {
  owner: string;
  name: string;
  createBranch: (name: string) => TE.TaskEither<Error, Branch>;
  deleteBranch: (name: string) => TE.TaskEither<Error, void>;
  commit: (params: GitHubRepositoryCommitParams) => TE.TaskEither<Error, Commit>;
  compareCommits: (base: string, head: string) => TE.TaskEither<Error, CommitDiffEntry[]>;
  findExistingPullRequestByBranch: (branch: string) => TE.TaskEither<Error, PullRequest | null>;
  closePullRequest: (number: number) => TE.TaskEither<Error, void>;
  createOrUpdatePullRequest: (
    params: GitHubRepositoryCreateOrUpdatePullRequestParams,
  ) => TE.TaskEither<Error, PullRequest>;
  addPullRequestLabels: (number: number, labels: string[]) => TE.TaskEither<Error, void>;
  addPullRequestReviewers: (number: number, reviewers: string[]) => TE.TaskEither<Error, void>;
  addPullRequestAssignees: (number: number, assignees: string[]) => TE.TaskEither<Error, void>;
};

type CreateGitHubRepositoryParams = {
  rest: ReturnType<typeof getOctokit>['rest'];
  name: string;
};

const createGitHubRepository = TE.tryCatchK<Error, [CreateGitHubRepositoryParams], GitHubRepository>(
  async ({ rest, name }) => {
    const parsed = parseRepositoryName(name);
    if (T.isLeft(parsed)) {
      throw parsed.left;
    }

    const defaults = {
      owner: parsed.right[0],
      repo: parsed.right[1],
    };

    const { data: repo } = await rest.repos.get(defaults);
    const targetBranch = parsed.right[2] ?? repo.default_branch;

    return {
      owner: defaults.owner,
      name: defaults.repo,

      createBranch: TE.tryCatchK(async (name) => {
        // get base branch
        const { data: base } = await rest.git.getRef({
          ...defaults,
          ref: `heads/${targetBranch}`,
        });

        // update exisiting branch
        const updated = await TE.tryCatch(async () => {
          const { data } = await rest.git.updateRef({
            ...defaults,
            ref: `heads/${name}`,
            sha: base.object.sha,
            force: true,
          });
          return data;
        }, handleErrorReason)();

        if (T.isRight(updated)) {
          return {
            name,
            sha: updated.right.object.sha,
          };
        }

        // create branch
        const { data: ref } = await rest.git.createRef({
          ...defaults,
          ref: `refs/heads/${name}`,
          sha: base.object.sha,
        });

        return {
          name,
          sha: ref.object.sha,
        };
      }, handleErrorReason),

      deleteBranch: TE.tryCatchK(async (name) => {
        await rest.git.deleteRef({
          ...defaults,
          ref: `heads/${name}`,
        });
      }, handleErrorReason),

      commit: TE.tryCatchK(async ({ parent, branch, files, message, force }) => {
        // create tree
        const { data: tree } = await rest.git.createTree({
          ...defaults,
          base_tree: parent,
          tree: files.map((file) => ({
            mode: file.mode,
            path: file.path,
            content: file.content,
          })),
        });

        // commit
        const { data: commit } = await rest.git.createCommit({
          ...defaults,
          tree: tree.sha,
          message,
          parents: [parent],
        });

        // apply to branch
        await rest.git.updateRef({
          ...defaults,
          ref: `heads/${branch}`,
          sha: commit.sha,
          force,
        });

        return commit;
      }, handleErrorReason),

      compareCommits: TE.tryCatchK(async (base, head) => {
        const { data: diff } = await rest.repos.compareCommits({
          ...defaults,
          base,
          head,
        });

        return diff.files!;
      }, handleErrorReason),

      findExistingPullRequestByBranch: TE.tryCatchK(async (branch) => {
        const { data: prs } = await rest.pulls.list({
          ...defaults,
          state: 'open',
          head: `${defaults.owner}:${branch}`,
        });

        return prs[0] ?? null;
      }, handleErrorReason),

      closePullRequest: TE.tryCatchK(async (number) => {
        await rest.pulls.update({
          ...defaults,
          pull_number: number,
          state: 'closed',
        });
      }, handleErrorReason),

      createOrUpdatePullRequest: TE.tryCatchK(async ({ title, body, number, branch }) => {
        if (number !== null && number !== undefined) {
          const { data } = await rest.pulls.update({
            ...defaults,
            base: targetBranch,
            pull_number: number,
            title,
            body,
          });
          return data;
        } else {
          const { data } = await rest.pulls.create({
            ...defaults,
            base: targetBranch,
            head: branch,
            title,
            body,
          });
          return data;
        }
      }, handleErrorReason),

      addPullRequestLabels: TE.tryCatchK(async (number, labels) => {
        await rest.issues.addLabels({
          ...defaults,
          issue_number: number,
          labels,
        });
      }, handleErrorReason),

      addPullRequestReviewers: TE.tryCatchK(async (number, original) => {
        const [reviewers, team_reviewers] = original.reduce<[string[], string[]]>(
          (acc, cur) => {
            const match = cur.match(/^team:(.+)$/);
            if (match !== null) {
              acc[1].push(removeAtMark(match[1]!));
            } else {
              acc[0].push(removeAtMark(cur));
            }
            return acc;
          },
          [[], []],
        );

        await rest.pulls.requestReviewers({
          ...defaults,
          pull_number: number,
          reviewers,
          team_reviewers,
        });
      }, handleErrorReason),

      addPullRequestAssignees: TE.tryCatchK(async (number, assignees) => {
        await rest.issues.addAssignees({
          ...defaults,
          issue_number: number,
          assignees: assignees.map((a) => removeAtMark(a)),
        });
      }, handleErrorReason),
    };
  },
  handleErrorReason,
);

export type GitHub = {
  initializeRepository: (name: string) => TE.TaskEither<Error, GitHubRepository>;
};

export const createGitHub = (inputs: Inputs): GitHub => {
  const { rest } = getOctokit(inputs.github_token, {
    baseUrl: inputs.github_api_url,
  });

  return {
    initializeRepository: TE.tryCatchK(async (name) => {
      const repo = await createGitHubRepository({
        rest,
        name,
      })();
      if (T.isLeft(repo)) {
        throw repo.left;
      }
      return repo.right;
    }, handleErrorReason),
  };
};
