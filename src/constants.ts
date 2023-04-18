export const GH_SERVER = process.env['GITHUB_SERVER_URL'] ?? '';
export const GH_REPOSITORY = process.env['GITHUB_REPOSITORY'] ?? '';
export const GH_WORKFLOW = process.env['GITHUB_WORKFLOW'] ?? '';
export const GH_RUN_ID = process.env['GITHUB_RUN_ID'] ?? '0';
export const GH_RUN_NUMBER = process.env['GITHUB_RUN_NUMBER'] ?? '0';

export const PR_FOOTER = `
---

<div align="right">

:package: Generated by [wadackel/files-sync-action](https://github.com/wadackel/files-sync-action).

</div>`;

export const defaultEntryConfig = {
  commit: {
    // default -> 'chore: sync files with `owner/repo`'
    format: '<%- prefix %>: <%- subject %>',
    prefix: 'chore',
    subject: 'sync files with `<%- repository %>`',
  },
  branch: {
    // default -> 'files-sync/owner-repo-0'
    format: '<%- prefix %>/<%- repository %>-<%- index %>',
    prefix: 'files-sync',
  },
  pull_request: {
    disabled: false,
    title: 'Sync files with `<%- repository %>`',
    body: `
This PR contains the following updates:

| :chart_with_upwards_trend: Change | :hammer_and_wrench: Synchronizing Repository | :link: Workflow |
| :-- | :-- | :-- |
| <%- changes.length %> files | [<%- repository %>](<%- github %>/<%- repository %>) | [\`<%- workflow %>#<%- run.number %>\`](<%- run.url %>) |

---

### Changed Files

<%_ for (const file of changes) { -%>
- <% if (file.from === file.to) { %>\`<%- file.to %>\`<% } else { %>\`<%- file.from %>\` to \`<%- file.to %>\`<% }%>
<%_ } -%>
    `.trim(),
    reviewers: [] as string[],
    assignees: [] as string[],
    labels: [] as string[],
  },
};

export const defaultFile = {
  exclude: [] as string[],
};
