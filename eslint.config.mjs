import { defineConfig, globalIgnores } from "eslint/config";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";

const eslintConfig = defineConfig([
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    extends: [eslintReact.configs.recommended],
    plugins: {
      "react-hooks": reactHooks,
      "@typescript-eslint": tseslint,
      prettier,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "prettier/prettier": "error",
    },
  },

  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { prettier },
    rules: {
      "prettier/prettier": "error",
    },
  },

  globalIgnores([
    "dist/**",
    "out/**",
    "build/**",
    "**/routeTree.gen.ts",
    ".infrastructure/**",
  ]),
]);

export default eslintConfig;
