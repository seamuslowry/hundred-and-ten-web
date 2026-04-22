import { defineConfig, globalIgnores } from "eslint/config";
import react from "eslint-plugin-react";
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
    plugins: {
      react,
      "react-hooks": reactHooks,
      "@typescript-eslint": tseslint,
      prettier,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
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

  globalIgnores(["dist/**", "out/**", "build/**", "routeTree.gen.ts"]),
]);

export default eslintConfig;
