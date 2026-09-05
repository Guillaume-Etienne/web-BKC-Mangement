import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Le code écrit `const { id: _id, ...rest } = lesson` pour dire « tout
      // sauf l'id ». Sans cette règle, ESLint réclame l'usage de `_id` et il
      // fallait un `// eslint-disable-next-line` à chaque fois — six dans le
      // repo avant ce réglage. Le `_` initial est la convention, ici elle est
      // enfin déclarée.
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern:          '^_',
        argsIgnorePattern:          '^_',
        caughtErrorsIgnorePattern:  '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
])
