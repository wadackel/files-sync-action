# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`files-sync-action` is a GitHub Action that synchronizes files across multiple repositories based on YAML configuration. It creates PRs to sync files, supports EJS templating, and offers flexible configuration for commits, branches, and pull requests.

## Common Commands

### Development

```bash
# Install dependencies (requires corepack)
corepack enable pnpm
pnpm i

# Build the action (compiles to dist/index.js using @vercel/ncc)
pnpm build

# Run tests
pnpm test
pnpm test:watch

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint              # oxlint only
pnpm format            # oxlint --fix + prettier
pnpm format:lint       # oxlint --fix only
pnpm format:prettier   # prettier only

# Code generation (inputs schema + docs)
pnpm generate          # Runs generate:inputs, generate:docs, and format
pnpm generate:inputs   # Generate input schema from TypeScript types
pnpm generate:docs     # Generate documentation using gha-docgen
```

### Local Testing

To test the action locally during development:

1. Create `test.yaml` (gitignored) with your sync configuration
2. Create `test.js` (gitignored) with environment setup:

```javascript
process.env['INPUT_GITHUB_TOKEN'] = '...';
process.env['INPUT_CONFIG_FILE'] = 'test.yaml';
process.env['INPUT_GITHUB_API_URL'] = 'https://api.github.com';
process.env['GITHUB_SERVER_URL'] = 'https://github.com';
process.env['GITHUB_REPOSITORY'] = 'local/test';
process.env['GITHUB_RUN_ID'] = '0';
process.env['GITHUB_RUN_NUMBER'] = '0';
await import('./dist/index.js');
```

3. Run: `pnpm build && node test.js`

## Code Style

### Language

All code, comments, and documentation must be written in English:

- Source code (TypeScript/JavaScript)
- Inline comments and JSDoc comments
- Commit messages
- Pull request titles and descriptions
- Documentation files (README.md, CLAUDE.md, etc.)

This ensures consistency and accessibility for international contributors.

## Architecture

### Core Flow (src/main.ts)

The main execution flow:

1. **Load Configuration**: Parse `.github/files-sync-config.yaml` (or custom path) using Zod schemas
2. **Process Patterns**: Iterate through each pattern in the configuration
3. **Resolve Files**: Expand file/directory paths, apply exclusions, optionally render with EJS templates
4. **Repository Operations**: For each target repository:
   - Initialize repository and find/create branch
   - Find existing PR or create new branch
   - Commit files (force mode overwrites from base, otherwise from head)
   - Compare commits to detect changes
   - Create/update PR, add labels/reviewers/assignees
   - Optionally merge PR based on merge configuration
5. **Output**: Return PR URLs and synced file list

### Key Modules

- **src/config.ts**: Zod schemas for configuration validation. Defines `Config`, `PatternConfig`, `SettingsConfig`, and related types
- **src/github.ts**: GitHub API wrapper using Octokit. Returns `GitHubRepository` interface with methods for branches, commits, PRs, and merging
- **src/inputs.ts**: GitHub Actions input parsing and validation
- **src/utils.ts**: Utility functions including `merge()` for deep merging configs, `convertValidBranchName()`, and `splitCommitMessage()`
- **src/constants.ts**: Default configurations for commits, branches, PRs, and merge settings

### Functional Programming Patterns

The codebase uses `fp-ts` extensively:

- `TaskEither<E, A>` for async operations that can fail
- `Either<E, A>` for synchronous operations that can fail
- `pipe()` for composing operations
- Error handling is explicit through the Either/TaskEither types

Example pattern:

```typescript
const result = await someOperation()(); // TaskEither needs double invocation
if (T.isLeft(result)) {
  // Handle error: result.left
} else {
  // Handle success: result.right
}
```

### Configuration Inheritance

Settings defined in `settings` are inherited by all `patterns`. Each pattern can override:

- `commit`: Commit message format, prefix, subject
- `branch`: Branch name format, prefix
- `pull_request`: PR title, body, reviewers, assignees, labels, merge settings

The `merge()` utility performs deep merging of configurations.

### File Synchronization

Files can be specified as:

- Simple string: `"tsconfig.json"` (from and to are the same)
- Detailed object: `{ from: "workflows/ci.yaml", to: ".github/workflows/ci.yaml", exclude: ["*.txt"] }`

Directories are expanded using `fast-glob` and exclusions use `micromatch` patterns.

### EJS Templates

Templates are applied to:

- File contents (if `template` object is provided in pattern)
- Commit messages (`commit.format`, `commit.subject`)
- Branch names (`branch.format`)
- PR title and body (`pull_request.title`, `pull_request.body`)

Available template variables vary by context (see README.md for details).

## Build Process

The action is compiled using `@vercel/ncc` which bundles all dependencies into `dist/index.js`. The `dist/` directory must be committed and stay in sync with source code. CI verifies this by checking for uncommitted changes after build.

## Release Process

Uses `semantic-release` with conventional commits:

- Commits to `main` trigger automatic releases
- Version bumps and GitHub releases are created automatically
- Major version tags are updated using `semantic-release-major-tag`

## Git Hooks

Lefthook manages pre-commit and commit-msg hooks:

- **pre-commit**: Runs prettier and oxlint on staged files
- **commit-msg**: Validates commit messages with commitlint (conventional commits)

Install with `pnpm prepare` (runs `lefthook install`).

## Testing Strategy

Tests use Vitest. The test suite covers:

- Utility functions (src/utils.test.ts)
- Configuration parsing and validation
- E2E tests run in GitHub Actions (see .github/workflows/e2e.yaml)

## Code Generation

The `scripts/generate-inputs.ts` script uses `ts-morph` to:

1. Parse TypeScript types from `src/inputs.ts`
2. Generate the input schema in `action.yaml`
3. Keep documentation in sync with code

After modifying input types, run `pnpm generate` to update generated files.
