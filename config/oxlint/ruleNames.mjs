/**
 * Oxlint and ESLint name some rules differently. This maps between the two, so Oxlint findings can be
 * reported, compared and gated under ESLint's rule ids. Adapted from Expensify/App config/oxlint/ruleNames.mjs.
 * Plain `.mjs` because Oxlint JS plugins cannot load TypeScript.
 */
import {HOSTED_RULE_ORIGIN, STAND_INS} from './derive.mjs';

const OXLINT_RULE_RENAMES = {
    'no-object-constructor': 'no-new-object',
    'no-new-native-nonconstructor': 'no-new-symbol',
};

// Oxlint native plugin names that differ from the ESLint plugin prefix.
const NATIVE_PLUGIN_PREFIX = {
    typescript: '@typescript-eslint',
    jsx_a11y: 'jsx-a11y',
    react_perf: 'react-perf',
};

// ESLint runs the @typescript-eslint extension of these rules on TS files and the core rule on JS files.
// Oxlint has one native rule (reported as `eslint(<rule>)`) that understands TypeScript, so the ESLint id
// depends on the file being linted.
const TS_EXTENSION_RULES = new Set([
    'default-param-last',
    'max-params',
    'no-array-constructor',
    'no-dupe-class-members',
    'no-empty-function',
    'no-loop-func',
    'no-loss-of-precision',
    'no-redeclare',
    'no-shadow',
    'no-unused-expressions',
    'no-unused-vars',
    'no-use-before-define',
    'no-useless-constructor',
]);
// eslint-plugin-react-hooks rules that Oxlint implements inside its native `react` plugin.
const REACT_HOOKS_RULES = new Set([
    'rules-of-hooks',
    'exhaustive-deps',
    'static-components',
    'use-memo',
    'preserve-manual-memoization',
    'incompatible-library',
    'immutability',
    'globals',
    'refs',
    'set-state-in-effect',
    'error-boundaries',
    'purity',
    'set-state-in-render',
    'unsupported-syntax',
]);

const TS_FILE = /\.(ts|tsx|mts|cts)$/;

const OXLINT_DIAGNOSTIC_CODE = /^([\w@/.-]+)\((.+)\)$/;

/**
 * Converts an Oxlint diagnostic code, like `typescript(no-explicit-any)`, to ESLint's rule id, like
 * `@typescript-eslint/no-explicit-any`. A code that does not look like `plugin(rule)` comes back unchanged.
 * @param {string} code
 * @param {string} [filename] the linted file; needed to tell `no-unused-vars` from `@typescript-eslint/no-unused-vars`
 * @returns {string}
 */
function oxlintCodeToESLintRuleID(code, filename = '') {
    const match = OXLINT_DIAGNOSTIC_CODE.exec(code);
    if (!match) {
        return code;
    }
    const [, rawPlugin, rule] = match;
    const plugin = rawPlugin.replace(/^eslint-plugin-/, '');
    if (plugin === 'eslint' && TS_EXTENSION_RULES.has(rule) && TS_FILE.test(filename)) {
        return `@typescript-eslint/${rule}`;
    }
    if (plugin === 'eslint' || plugin === 'core') {
        return OXLINT_RULE_RENAMES[rule] ?? rule;
    }
    if (plugin === 'react' && REACT_HOOKS_RULES.has(rule)) {
        return `react-hooks/${rule}`;
    }
    if (plugin === 'hosted') {
        const origin = HOSTED_RULE_ORIGIN[rule];
        if (!origin) {
            throw new Error(`No HOSTED_RULE_ORIGIN entry for hosted rule "${rule}". Add it to config/oxlint/ruleNames.mjs.`);
        }
        return `${origin}/${rule}`;
    }
    return `${NATIVE_PLUGIN_PREFIX[plugin] ?? plugin}/${rule}`;
}

export {HOSTED_RULE_ORIGIN, OXLINT_RULE_RENAMES, REACT_HOOKS_RULES, STAND_INS, TS_EXTENSION_RULES, oxlintCodeToESLintRuleID};
