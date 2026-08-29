// @types/ejs stops at 3.1.5 and declares named exports, a shape ejs 6 no longer has.
// Keeping it would let `import { render } from ejs` type-check and then fail at run time.
declare module 'ejs' {
  const ejs: {
    render(template: string, data?: Record<string, unknown>): string;
  };
  export default ejs;
}
