/**
 * Count-threshold lint gate (experiment, replaces a seatbelt baseline).
 *
 * Every rule that had violations when eslint-config-expensify 4.x was adopted is downgraded from `error` to
 * `warn` in eslint.config.mjs and in config/oxlint/sourceConfig.mjs (which the Oxlint config is derived from), and
 * CI runs the linters with `--max-warnings <total>`
 * (see the `lint` and `lint:oxlint` scripts in package.json). Errors still fail on their own, so any rule
 * not listed here stays strict. Shrink this list (and the thresholds) as rules reach zero.
 */
const LINT_DEBT_RULES = new Set([
    '@typescript-eslint/consistent-type-definitions',
    '@typescript-eslint/naming-convention',
    '@typescript-eslint/no-deprecated',
    '@typescript-eslint/no-empty-object-type',
    '@typescript-eslint/no-loop-func',
    '@typescript-eslint/no-misused-promises',
    '@typescript-eslint/no-non-null-assertion',
    '@typescript-eslint/no-redundant-type-constituents',
    '@typescript-eslint/no-restricted-types',
    '@typescript-eslint/no-unnecessary-type-assertion',
    '@typescript-eslint/no-unsafe-argument',
    '@typescript-eslint/no-unsafe-assignment',
    '@typescript-eslint/no-unsafe-call',
    '@typescript-eslint/no-unsafe-member-access',
    '@typescript-eslint/no-unsafe-return',
    '@typescript-eslint/no-unsafe-type-assertion',
    '@typescript-eslint/no-unused-vars',
    '@typescript-eslint/no-use-before-define',
    '@typescript-eslint/non-nullable-type-assertion-style',
    '@typescript-eslint/prefer-nullish-coalescing',
    '@typescript-eslint/restrict-template-expressions',
    '@typescript-eslint/unbound-method',
    'import/no-extraneous-dependencies',
    'jsdoc/no-types',
    'rulesdir/prefer-at',
]);

const isError = (severity) => severity === 'error' || severity === 2;

/**
 * Turns an `error` rule entry into `warn`, keeping its options. `off` and `warn` entries are returned as is,
 * so a rule is never switched on where the shared config turned it off.
 * @param {unknown} entry a rule entry such as `'error'` or `['error', {...}]`
 * @returns {unknown}
 */
function downgradeToWarn(entry) {
    if (Array.isArray(entry)) {
        return isError(entry[0]) ? ['warn', ...entry.slice(1)] : entry;
    }
    return isError(entry) ? 'warn' : entry;
}

/**
 * Downgrades the debt rules in a rules object. `toESLintIds` maps a rule key to the ESLint ids it stands for.
 * @template {Record<string, unknown> | undefined} T
 * @param {T} rules
 * @param {(key: string) => string[]} [toESLintIds]
 * @returns {T}
 */
function downgradeDebtRules(rules, toESLintIds) {
    if (!rules) {
        return rules;
    }
    const isDebt = (key) => (toESLintIds ? toESLintIds(key) : [key]).some((id) => LINT_DEBT_RULES.has(id));
    return /** @type {T} */ (Object.fromEntries(Object.entries(rules).map(([key, entry]) => [key, isDebt(key) ? downgradeToWarn(entry) : entry])));
}

export {LINT_DEBT_RULES, downgradeDebtRules, downgradeToWarn};
