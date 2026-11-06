// Rules that already had violations when eslint-config-expensify 4.x was adopted report as warnings instead of
// errors, and the `lint` and `lint:oxlint` scripts fail above the current warning count. Remove a rule here, and
// lower the counts, once it reaches zero.
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

function downgradeToWarn(entry) {
    if (Array.isArray(entry)) {
        return isError(entry[0]) ? ['warn', ...entry.slice(1)] : entry;
    }
    return isError(entry) ? 'warn' : entry;
}

/**
 * @template {Record<string, unknown>} T
 * @param {T} rules
 * @returns {T}
 */
function downgradeDebtRules(rules) {
    return /** @type {T} */ (Object.fromEntries(Object.entries(rules).map(([ruleId, entry]) => [ruleId, LINT_DEBT_RULES.has(ruleId) ? downgradeToWarn(entry) : entry])));
}

export default downgradeDebtRules;
