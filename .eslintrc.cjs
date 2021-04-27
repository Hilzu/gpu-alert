"use strict";

module.exports = {
  env: {
    es2020: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:node/recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    "no-loss-of-precision": "error",
    "no-promise-executor-return": "error",
    "no-template-curly-in-string": "error",
    "no-unreachable-loop": "error",
    "no-unsafe-optional-chaining": "error",
    "no-useless-backreference": "error",
    "node/file-extension-in-import": "error",
    "prefer-promise-reject-errors": "error",
    "require-atomic-updates": "error",
  },
  overrides: [
    {
      files: ["*.cjs", "*.js"],
      parserOptions: { sourceType: "script" },
      rules: { strict: ["error", "global"] },
    },
  ],
};
