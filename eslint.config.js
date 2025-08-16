// eslint.config.js
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest", // Always use the latest ECMAScript features
      sourceType: "module",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: {
    // Example overrides (customize as needed)
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
});