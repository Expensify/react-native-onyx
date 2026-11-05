/**
 * Builds the Oxlint config from config/oxlint/sourceConfig.mjs (eslint-config-expensify presets plus Onyx's
 * blocks) every time Oxlint loads it, so Oxlint follows eslint-config-expensify without a hand-kept rule list.
 *
 * 1. `@oxlint/migrate` converts the ESLint config and reports the rules it could not convert.
 * 2. Known migrate pitfalls are fixed (invalid options, jsPlugins inside overrides, missing settings).
 * 3. Converted rules that Oxlint cannot run natively are run with ESLint's own code through JS plugins
 *    (config/oxlint/plugins): ESLint core rules as `core/<rule>`, ESLint plugin rules as `hosted/<rule>`.
 *    Their severities and options are replayed from the source config block by block, in ESLint's order.
 *
 * A rule that can run neither natively nor as a JS plugin must be listed in NOT_PORTED, or config loading
 * fails. That way a new rule in eslint-config-expensify gets a decision instead of being dropped silently.
 *
 * Config and JS plugins load in the same Node process, so the plugin files import the rule lists from here
 * and this module runs once per Oxlint invocation.
 */
import migrate from '@oxlint/migrate';
import {builtinRules} from 'eslint/use-at-your-own-risk';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import eslintConfig from './sourceConfig.mjs';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expensifyConfigDirectory = path.dirname(require.resolve('eslint-config-expensify', {paths: [repoRoot]}));

/**
 * Resolves a package the way eslint-config-expensify does, so plugins it depends on load even when they are
 * not direct dependencies of Onyx.
 * @param {string} request
 * @returns {string}
 */
function resolvePackage(request) {
    return require.resolve(request, {paths: [expensifyConfigDirectory, repoRoot]});
}

// ESLint plugins whose names Oxlint reserves for its native ports. Their rules can only run under `hosted`.
const HOSTABLE_PLUGINS = {
    react: 'eslint-plugin-react',
    import: 'eslint-plugin-import',
    jsdoc: 'eslint-plugin-jsdoc',
    '@typescript-eslint': '@typescript-eslint/eslint-plugin',
};

// Rules migrate converts to a native rule that behaves differently, hosted to keep ESLint's behavior.
const ALWAYS_HOSTED = new Set([
    // Native import/prefer-default-export ignores `export type {...}`; ESLint's reports it (tests/types.ts).
    'import/prefer-default-export',
]);

// Type-checked rules that still work as JS plugins once parser services are stubbed (see hosted-rules.mjs).
// Onyx's naming-convention options use no `types` selector, so the type checker is never reached.
const STUBBED_PARSER_SERVICES = new Set(['@typescript-eslint/naming-convention']);

// Rules ESLint runs that Oxlint does not.
const NOT_PORTED = {
    'no-invalid-this': 'calls sourceCode.getJSDocComment, which the JS plugin bridge lacks (the plugin throws and drops every JS-plugin finding in the file)',
    'react/jsx-uses-react': 'only marks variables as used; Oxlint no-unused-vars understands JSX',
    'react/jsx-uses-vars': 'only marks variables as used; Oxlint no-unused-vars understands JSX',
    'react-hooks/component-hook-factories': 'React Compiler diagnostic category that Oxlint does not implement',
    'react-hooks/config': 'React Compiler diagnostic category that Oxlint does not implement',
    'react-hooks/gating': 'React Compiler diagnostic category that Oxlint does not implement',
    '@typescript-eslint/prefer-optional-chain': 'needs type information; the native rule is nursery',
    'rulesdir/boolean-conditional-rendering': 'needs type information; no Oxlint equivalent',
};

// Native Oxlint rules configured in place of ESLint rules that cannot run in Oxlint (Oxlint rule: ESLint rule).
// unicorn/prefer-at keeps default options: `checkAllIndexAccess` adds hundreds of reports on tuple access that
// the type-aware ESLint rule skips.
const STAND_INS = {
    'unicorn/prefer-at': 'rulesdir/prefer-at',
};
const STAND_IN_FOR = Object.fromEntries(Object.entries(STAND_INS).map(([oxlintRule, eslintRule]) => [eslintRule, oxlintRule]));

// Rules migrate copies with options that Oxlint rejects.
const DROP_OPTIONS = new Set(['react/jsx-no-duplicate-props', 'react/jsx-no-undef']);

// Matches a glob for TypeScript files, like `**/*.ts`, `**/*.ts?(x)` or `**/*.{js,ts}`.
const TYPESCRIPT_GLOB = /\.(\{[^}]*\b)?[cm]?tsx?\b/;

const pluginRulesCache = new Map();

/**
 * Loads the rules of an installed ESLint plugin, so Oxlint runs the same rule code as ESLint.
 * @param {string} prefix an ESLint rule prefix from HOSTABLE_PLUGINS, like `react`
 * @returns {Record<string, import('eslint').Rule.RuleModule>}
 */
function pluginRules(prefix) {
    if (!pluginRulesCache.has(prefix)) {
        const mod = require(resolvePackage(HOSTABLE_PLUGINS[prefix]));
        pluginRulesCache.set(prefix, mod?.rules ?? mod?.default?.rules ?? {});
    }
    return pluginRulesCache.get(prefix);
}

/**
 * @param {string} ruleId an ESLint rule id
 * @returns {{prefix: string, name: string}}
 */
function splitRuleId(ruleId) {
    const slash = ruleId.lastIndexOf('/');
    return slash === -1 ? {prefix: '', name: ruleId} : {prefix: ruleId.slice(0, slash), name: ruleId.slice(slash + 1)};
}

/**
 * Runs migrate and returns its config plus the rules it skipped. The second, non-type-aware pass finds ESLint
 * core rules that migrate swaps for a type-aware typescript/* rule (like dot-notation). tsgolint only checks
 * files in the TypeScript program, so those still need the core rule on JS files.
 */
async function runMigrate() {
    const skipped = new Set();
    const run = async (typeAware) => {
        const skippedHere = new Map();
        const reporter = {
            addWarning: () => {},
            getWarnings: () => [],
            markSkipped: (rule, category) => skippedHere.set(`${rule}\0${category}`, rule),
            removeSkipped: (rule, category) => skippedHere.delete(`${rule}\0${category}`),
            getSkippedRulesByCategory: () => ({}),
        };
        const config = await migrate(eslintConfig, undefined, {reporter, typeAware, jsPlugins: true});
        for (const rule of skippedHere.values()) {
            if (typeAware || builtinRules.has(rule)) {
                skipped.add(rule);
            }
        }
        return config;
    };
    const config = await run(true);
    await run(false);
    return {config, skipped};
}

const {config: migrated, skipped} = await runMigrate();

const coreRuleNames = [];
const hostedRuleIds = [];
for (const ruleId of [...skipped, ...ALWAYS_HOSTED]) {
    const {prefix, name} = splitRuleId(ruleId);
    if (NOT_PORTED[ruleId] || STAND_IN_FOR[ruleId]) {
        continue;
    }
    if (!prefix && builtinRules.has(name)) {
        coreRuleNames.push(name);
        continue;
    }
    const rule = HOSTABLE_PLUGINS[prefix] ? pluginRules(prefix)[name] : undefined;
    if (rule && (!rule.meta?.docs?.requiresTypeChecking || STUBBED_PARSER_SERVICES.has(ruleId))) {
        hostedRuleIds.push(ruleId);
        continue;
    }
    throw new Error(`Oxlint cannot run ${ruleId} natively or as a JS plugin. Add it to NOT_PORTED or STAND_INS in config/oxlint/derive.mjs.`);
}

// Hosted rules share the `hosted` namespace, so this maps each one back to its ESLint plugin.
const HOSTED_RULE_ORIGIN = {};
for (const ruleId of hostedRuleIds) {
    const {prefix, name} = splitRuleId(ruleId);
    if (HOSTED_RULE_ORIGIN[name]) {
        throw new Error(`hosted/${name} would stand for both ${HOSTED_RULE_ORIGIN[name]}/${name} and ${ruleId}`);
    }
    HOSTED_RULE_ORIGIN[name] = prefix;
}

/**
 * Maps an ESLint rule id to the JS-plugin rule that runs it in Oxlint, if any.
 * @param {string} ruleId
 * @returns {string | undefined}
 */
function jsPluginRuleFor(ruleId) {
    if (coreRuleNames.includes(ruleId)) {
        return `core/${ruleId}`;
    }
    return hostedRuleIds.includes(ruleId) ? `hosted/${splitRuleId(ruleId).name}` : undefined;
}

/**
 * @param {unknown} entry
 * @returns {unknown}
 */
const severityOf = (entry) => (Array.isArray(entry) ? entry[0] : entry);

/**
 * Fixes the rules of one migrated config block.
 * @param {Record<string, unknown> | undefined} rules
 * @param {boolean} isTypeScriptBlock whether the block matches TypeScript files
 * @returns {Record<string, unknown>}
 */
function fixRules(rules = {}, isTypeScriptBlock = false) {
    const out = {};
    for (const [rule, entry] of Object.entries(rules)) {
        if (ALWAYS_HOSTED.has(rule)) {
            continue;
        }
        if (rule.startsWith('rulesdir/')) {
            // eslint-plugin-expensify rules need type information, which Oxlint JS plugins lack.
            if (STAND_IN_FOR[rule]) {
                out[STAND_IN_FOR[rule]] = severityOf(entry);
            } else if (severityOf(entry) !== 'off' && !NOT_PORTED[rule]) {
                throw new Error(`${rule} is enabled but has no Oxlint stand-in. Add it to NOT_PORTED or STAND_INS in config/oxlint/derive.mjs.`);
            }
            continue;
        }
        if (DROP_OPTIONS.has(rule)) {
            out[rule] = severityOf(entry);
            continue;
        }
        if (rule === 'import/no-cycle' && Array.isArray(entry)) {
            // migrate copies ESLint's default maxDepth "∞", which Oxlint rejects; Oxlint's default is unlimited too.
            const {maxDepth, ...options} = entry[1] ?? {};
            out[rule] = maxDepth === '∞' ? [entry[0], options] : entry;
            continue;
        }
        if (rule === 'no-unused-vars' && isTypeScriptBlock && Array.isArray(entry)) {
            // typescript-eslint's no-unused-vars reports values only used as types; Oxlint needs this option for that.
            out[rule] = [entry[0], {...entry[1], reportVarsOnlyUsedAsTypes: true}];
            continue;
        }
        out[rule] = entry;
    }
    return out;
}

/**
 * Deep-merges the `import/*` settings of every ESLint block, as ESLint does for the files that match them.
 * Oxlint has no per-override settings and its own import rules ignore these, but the hosted eslint-plugin-import
 * rules read them. `import/parsers` is left out: Oxlint parses every file itself.
 * @returns {Record<string, unknown>}
 */
function importSettings() {
    const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
    const merge = (target, source) => {
        for (const [key, value] of Object.entries(source)) {
            target[key] = isObject(value) && isObject(target[key]) ? merge({...target[key]}, value) : value;
        }
        return target;
    };
    const settings = {};
    for (const block of eslintConfig) {
        const entries = Object.entries(block.settings ?? {}).filter(([key]) => key.startsWith('import/') && key !== 'import/parsers');
        merge(settings, Object.fromEntries(entries));
    }
    return settings;
}

/**
 * Collects the jsPlugins migrate put inside overrides, which Oxlint only accepts at the root.
 * @returns {Array<{name: string, specifier: string}>}
 */
function hoistedJsPlugins() {
    const specifiers = new Set([migrated, ...(migrated.overrides ?? [])].flatMap((block) => block.jsPlugins ?? []));
    // eslint-plugin-expensify (rulesdir) rules are handled by fixRules.
    specifiers.delete('eslint-plugin-rulesdir');
    return [...specifiers].map((specifier) => ({
        name: specifier.replace(/^eslint-plugin-/, ''),
        specifier: resolvePackage(specifier),
    }));
}

/**
 * Replays the source config for the rules that run as JS plugins, in ESLint block order.
 * @returns {{rules: Record<string, unknown>, overrides: Array<{files: string[], rules: Record<string, unknown>}>}}
 */
function replayJsPluginRules() {
    const rules = {};
    const overrides = [];
    const scopedRules = new Set();
    for (const block of eslintConfig) {
        const hits = Object.entries(block.rules ?? {}).flatMap(([ruleId, entry]) => {
            const target = jsPluginRuleFor(ruleId);
            return target ? [[target, entry]] : [];
        });
        if (!hits.length) {
            continue;
        }
        if (block.ignores) {
            throw new Error('ESLint block with both rules and ignores; replaying it is not supported');
        }
        if (!block.files) {
            const clash = hits.filter(([rule]) => scopedRules.has(rule)).map(([rule]) => rule);
            if (clash.length) {
                throw new Error(`Unscoped ESLint block after a scoped one sets ${clash.join(', ')}; Oxlint would apply them in a different order`);
            }
            Object.assign(rules, Object.fromEntries(hits));
            continue;
        }
        if (block.files.some(Array.isArray)) {
            throw new Error('ESLint `files` with nested arrays (AND patterns) cannot be expressed in Oxlint');
        }
        hits.forEach(([rule]) => scopedRules.add(rule));
        overrides.push({files: block.files, rules: Object.fromEntries(hits)});
    }
    return {rules, overrides};
}

const replayed = replayJsPluginRules();

/** @type {import('oxlint').OxlintConfig} */
const oxlintConfig = {
    plugins: migrated.plugins,
    jsPlugins: [
        {name: 'core', specifier: fileURLToPath(new URL('plugins/core-rules.mjs', import.meta.url))},
        {name: 'hosted', specifier: fileURLToPath(new URL('plugins/hosted-rules.mjs', import.meta.url))},
        ...hoistedJsPlugins(),
    ],
    categories: migrated.categories,
    options: {typeAware: true},
    env: migrated.env,
    globals: migrated.globals,
    settings: {
        ...migrated.settings,
        ...importSettings(),
        // ESLint detects the version; Oxlint needs it spelled out.
        react: {...migrated.settings?.react, version: require(resolvePackage('react/package.json')).version},
    },
    ignorePatterns: migrated.ignorePatterns,
    rules: {...fixRules(migrated.rules), ...replayed.rules},
    overrides: [
        ...(migrated.overrides ?? []).map(({files, plugins, env, globals, rules}) => ({
            files,
            ...(plugins ? {plugins} : {}),
            ...(env ? {env} : {}),
            ...(globals ? {globals} : {}),
            ...(rules
                ? {
                      rules: fixRules(
                          rules,
                          files.some((file) => TYPESCRIPT_GLOB.test(file)),
                      ),
                  }
                : {}),
        })),
        ...replayed.overrides,
    ],
};

export {HOSTED_RULE_ORIGIN, STAND_INS, STUBBED_PARSER_SERVICES, coreRuleNames, hostedRuleIds, oxlintConfig, pluginRules, splitRuleId};
