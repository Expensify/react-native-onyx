// The eslint-config-expensify presets Onyx lints with. They stay in ESLint format because that is what the package
// ships and what @oxlint/migrate converts (derive.mjs). Onyx's own ignores, settings and overrides are in
// oxlint.config.mts, in Oxlint format.
import browserConfig from 'eslint-config-expensify/browser';
import jestConfig from 'eslint-config-expensify/jest';
import reactConfig from 'eslint-config-expensify/react';
import scriptsConfig from 'eslint-config-expensify/scripts';
import typescriptConfig from 'eslint-config-expensify/typescript';
import prettierConfig from 'eslint-config-prettier';

// The jest preset applies to Onyx's test and mock files only.
const JEST_FILES = ['tests/**', 'lib/**/__mocks__/**', 'jestSetup.js', 'jest-sequencer.js', 'jest-test-environment.ts'];

export default [...browserConfig, ...reactConfig, ...typescriptConfig, ...jestConfig.map((block) => ({...block, files: JEST_FILES})), ...scriptsConfig, prettierConfig];
