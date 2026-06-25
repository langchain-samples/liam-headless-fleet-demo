import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks 7.x flags every setState inside an effect, including the
      // legitimate patterns we rely on: SSR-safe portal mount guards
      // (`useEffect(() => setMounted(true), [])`) and async data loaders that
      // setState after a fetch. These are correct React, so keep them as
      // warnings (informative) rather than hard errors.
      "react-hooks/set-state-in-effect": "warn",
      // We render dynamically-selected lucide icons (`const Comp = resolveIcon(name)`).
      // The component is looked up from a stable map, not created per render, so
      // the static-components rule is a false positive here.
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
