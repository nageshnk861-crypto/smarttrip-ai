// eslint-config-next v16 exports a flat config array directly.
import nextConfig from 'eslint-config-next';

/** @type {import("eslint").Linter.FlatConfig[]} */
const eslintConfig = [
  // ── Ignore generated artefacts ───────────────────────────────────────────
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      'build/**',
      'public/**',
    ],
  },
  // ── Next.js recommended flat config ─────────────────────────────────────
  ...nextConfig,
];

export default eslintConfig;
