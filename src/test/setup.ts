/**
 * `src/env.js` validates at import time and throws on anything missing, which
 * would make importing a server module a crash rather than a test failure.
 * Skipping validation is the project's own documented escape hatch for exactly
 * this (see the comment in `src/env.js`); tests set the variables they care
 * about themselves.
 *
 * NODE_ENV is left alone — Vitest already sets it to "test", and it is typed
 * read-only here.
 */
process.env.SKIP_ENV_VALIDATION = "1";
