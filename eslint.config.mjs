import js from "@eslint/js";

export default [
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "build/**"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off", // TypeScript handles this
    },
  },
];
