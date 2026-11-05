/**
 * Oxlint and ESLint name some rules differently. This maps between the two, so Oxlint findings can be
 * reported, compared and gated under ESLint's rule ids. Adapted from Expensify/App config/oxlint/ruleNames.mjs.
 * Plain `.mjs` because Oxlint JS plugins cannot load TypeScript.
 */
const OXLINT_RULE_RENAMES = {
    'no-object-constructor': 'no-new-object',
    'no-new-native-nonconstructor': 'no-new-symbol',
};

// Oxlint reserves its native plugin prefixes (`react`, `import`, `jsdoc`, `@typescript-eslint`), so rules
// hosted from those ESLint plugins load under `hosted`. This maps each one back to its ESLint plugin.
const HOSTED_RULE_ORIGIN = {
    'naming-convention': '@typescript-eslint',
    'no-extraneous-dependencies': 'import',
    'no-useless-path-segments': 'import',
    'no-import-module-exports': 'import',
    'no-relative-packages': 'import',
    export: 'import',
    named: 'import',
    order: 'import',
    // Native import/prefer-default-export ignores `export type {...}`; ESLint's reports it (tests/types.ts).
    'prefer-default-export': 'import',
    'no-types': 'jsdoc',
    'check-param-names': 'jsdoc',
    'check-types': 'jsdoc',
    'jsx-no-bind': 'react',
    'no-typos': 'react',
    'no-arrow-function-lifecycle': 'react',
    'no-invalid-html-attribute': 'react',
    'require-render-return': 'react',
    'forbid-prop-types': 'react',
    'forbid-foreign-prop-types': 'react',
    'default-props-match-prop-types': 'react',
    'no-deprecated': 'react',
    'prefer-stateless-function': 'react',
    'sort-comp': 'react',
    'no-unused-state': 'react',
    'no-access-state-in-setstate': 'react',
    'static-property-placement': 'react',
    'prefer-exact-props': 'react',
    'no-unused-class-component-methods': 'react',
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
 * Lists the hosted rules copied from one ESLint plugin.
 * @param {string} eslintPrefix an ESLint plugin name, like `react`
 * @returns {string[]}
 */
function hostedRuleNames(eslintPrefix) {
    return Object.keys(HOSTED_RULE_ORIGIN).filter((name) => HOSTED_RULE_ORIGIN[name] === eslintPrefix);
}

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

// Native Oxlint rules configured in place of ESLint rules that cannot run in Oxlint.
const STAND_INS = {
    'unicorn/prefer-at': 'rulesdir/prefer-at',
};

/**
 * Maps a rule key as written in oxlint.config.mts (like `typescript/no-explicit-any`, `hosted/naming-convention`
 * or `no-unused-vars`) to the ESLint rule ids it stands for. A native rule that ESLint runs as both a core rule
 * and a typescript-eslint extension maps to both.
 * @param {string} key
 * @returns {string[]}
 */
function oxlintConfigRuleToESLintRuleIDs(key) {
    if (STAND_INS[key]) {
        return [STAND_INS[key]];
    }
    const slash = key.indexOf('/');
    if (slash === -1) {
        const name = OXLINT_RULE_RENAMES[key] ?? key;
        return TS_EXTENSION_RULES.has(key) ? [name, `@typescript-eslint/${key}`] : [name];
    }
    const plugin = key.slice(0, slash);
    const name = key.slice(slash + 1);
    if (plugin === 'core') {
        return [name];
    }
    if (plugin === 'hosted') {
        return [`${HOSTED_RULE_ORIGIN[name]}/${name}`];
    }
    if (plugin === 'typescript') {
        return [`@typescript-eslint/${name}`];
    }
    if (plugin === 'react' && REACT_HOOKS_RULES.has(name)) {
        return [`react-hooks/${name}`];
    }
    return [key];
}

export {STAND_INS, oxlintConfigRuleToESLintRuleIDs};
export {HOSTED_RULE_ORIGIN, OXLINT_RULE_RENAMES, REACT_HOOKS_RULES, TS_EXTENSION_RULES, hostedRuleNames, oxlintCodeToESLintRuleID};
