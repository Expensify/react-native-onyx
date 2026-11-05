/**
 * Oxlint config for react-native-onyx. No rule is written by hand: config/oxlint/derive.mjs converts the
 * eslint-config-expensify presets plus Onyx's own blocks (config/oxlint/sourceConfig.mjs) with @oxlint/migrate
 * each time Oxlint loads, so bumping eslint-config-expensify updates Oxlint. It does not read eslint.config.mjs.
 *
 * Rules Oxlint has no native version of run through JS plugins (see config/oxlint/plugins):
 * - core/*: ESLint core rules, with ESLint's own code.
 * - hosted/*: rules from ESLint plugins (typescript-eslint naming-convention, import, jsdoc, react).
 * - es/*: eslint-plugin-es, loaded as is (JS files only).
 *
 * Rules Oxlint cannot run at all are listed with the reason in NOT_PORTED and STAND_INS in derive.mjs.
 * Severities already include the warning gate in config/lintDebt.mjs.
 */
import {defineConfig} from 'oxlint';
import type {OxlintConfig} from 'oxlint';

import {oxlintConfig} from './config/oxlint/derive.mjs';

// Annotated because the inferred type is too large for TypeScript to serialize (declaration: true).
const config: OxlintConfig = defineConfig(oxlintConfig);

export default config;
