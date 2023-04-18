declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        GITHUB_API_URL?: string;
        GITHUB_SERVER_URL?: string;
        GITHUB_REPOSITORY?: string;
        GITHUB_WORKFLOW?: string;
        GITHUB_RUN_ID?: string;
        GITHUB_RUN_NUMBER?: string;
      }
    }
  }
}
