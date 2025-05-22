import eslint from '@ktam/lint-node/eslint';

export default [
  ...eslint,
  {
    ignores: ['src/services/generated/**'],
  },
];
