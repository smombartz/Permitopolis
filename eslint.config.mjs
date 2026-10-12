import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const REAL_CLOCK = "The demo runs on a fixed date. Use demoToday() and the helpers in lib/dates.ts.";
const RANDOM = "Ids are deterministic (derived from the case id). Randomness breaks the seed and prerendering.";
const DIALOG = "Use the Dialog component; browser dialogs block the demo.";
const STORAGE = "Go through lib/state/storage.ts so the app survives blocked storage.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "lib/state/storage.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: REAL_CLOCK },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: REAL_CLOCK },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: RANDOM },
        { selector: "CallExpression[callee.property.name='randomUUID']", message: RANDOM },
        { selector: "MemberExpression[object.name='window'][property.name=/^(confirm|alert|prompt)$/]", message: DIALOG },
        { selector: "MemberExpression[object.name='window'][property.name=/^(localStorage|sessionStorage)$/]", message: STORAGE },
      ],
      "no-restricted-globals": [
        "error",
        { name: "confirm", message: DIALOG },
        { name: "alert", message: DIALOG },
        { name: "prompt", message: DIALOG },
        { name: "localStorage", message: STORAGE },
        { name: "sessionStorage", message: STORAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/**",
  ]),
]);

export default eslintConfig;
