// Builds the Oxlint config from sourceConfig.mjs on every run, so eslint-config-expensify updates need no hand edits.
// @oxlint/migrate converts the rules Oxlint has natively. Rules it lacks run on ESLint's own code through ./plugins,
// with severities and options copied from the source config. A rule Oxlint cannot run at all must be listed in
// NOT_PORTED or STAND_INS, or loading fails, so a new preset rule is never dropped silently.
// Oxlint loads the config and the plugins in one Node process, so the plugins import their rule lists from here.
import migrate from '@oxlint/migrate';
import {builtinRules} from 'eslint/use-at-your-own-risk';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import eslintConfig from './sourceConfig.mjs';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expensifyConfigDirectory = path.dirname(require.resolve('eslint-config-expensify', {paths: [repoRoot]}));

// Plugins come in through eslint-config-expensify, not as Onyx dependencies.
function resolvePackage(request) {
    return require.resolve(request, {paths: [expensifyConfigDirectory, repoRoot]});
}

// Oxlint reserves these plugin names for its own ports, so their missing rules run under `hosted`.
const HOSTABLE_PLUGINS = {
    react: 'eslint-plugin-react',
    import: 'eslint-plugin-import',
    jsdoc: 'eslint-plugin-jsdoc',
    '@typescript-eslint': '@typescript-eslint/eslint-plugin',
};

const ALWAYS_HOSTED = new Set([
    // The native port ignores `export type {...}`, which ESLint reports (tests/types.ts).
    'import/prefer-default-export',
]);

// Type-checked rules that work with stubbed parser services (hosted-rules.mjs). This holds while Onyx's
// naming-convention options use no `types` selector, which would need the type checker.
const STUBBED_PARSER_SERVICES = new Set(['@typescript-eslint/naming-convention']);

const NOT_PORTED = {
    'no-invalid-this': 'calls sourceCode.getJSDocComment, which Oxlint JS plugins lack; the error drops every JS plugin report in the file',
    'react/jsx-uses-react': 'only marks variables as used; Oxlint no-unused-vars handles JSX itself',
    'react/jsx-uses-vars': 'only marks variables as used; Oxlint no-unused-vars handles JSX itself',
    'react-hooks/component-hook-factories': 'React Compiler check that Oxlint does not implement',
    'react-hooks/config': 'React Compiler check that Oxlint does not implement',
    'react-hooks/gating': 'React Compiler check that Oxlint does not implement',
    '@typescript-eslint/prefer-optional-chain': 'needs type information, and the native rule is still in nursery',
    'rulesdir/boolean-conditional-rendering': 'needs type information, and Oxlint has no equivalent',
};

// Native rules that replace ESLint rules Oxlint cannot run. unicorn/prefer-at keeps its defaults: `checkAllIndexAccess`
// adds hundreds of reports on tuple access that the type-aware ESLint rule skips.
const STAND_INS = {
    'unicorn/prefer-at': 'rulesdir/prefer-at',
};
const STAND_IN_FOR = Object.fromEntries(Object.entries(STAND_INS).map(([oxlintRule, eslintRule]) => [eslintRule, oxlintRule]));

// Oxlint rejects the options migrate copies for these rules.
const DROP_OPTIONS = new Set(['react/jsx-no-duplicate-props', 'react/jsx-no-undef']);

const TYPESCRIPT_GLOB = /\.(\{[^}]*\b)?[cm]?tsx?\b/;

const pluginRulesCache = new Map();

function pluginRules(prefix) {
    if (!pluginRulesCache.has(prefix)) {
        const mod = require(resolvePackage(HOSTABLE_PLUGINS[prefix]));
        pluginRulesCache.set(prefix, mod?.rules ?? mod?.default?.rules ?? {});
    }
    return pluginRulesCache.get(prefix);
}

function splitRuleId(ruleId) {
    const slash = ruleId.lastIndexOf('/');
    return slash === -1 ? {prefix: '', name: ruleId} : {prefix: ruleId.slice(0, slash), name: ruleId.slice(slash + 1)};
}

// The non-type-aware pass finds core rules that migrate swaps for a type-aware typescript/* rule (dot-notation).
// tsgolint only checks files in the TypeScript program, so JS files still need the core rule.
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

// Hosted rules share one namespace, so two plugins must not bring the same rule name.
const hostedNames = hostedRuleIds.map((ruleId) => splitRuleId(ruleId).name);
const duplicateName = hostedNames.find((name, index) => hostedNames.indexOf(name) !== index);
if (duplicateName) {
    throw new Error(`Two hosted rules would both be named hosted/${duplicateName}`);
}

function jsPluginRuleFor(ruleId) {
    if (coreRuleNames.includes(ruleId)) {
        return `core/${ruleId}`;
    }
    return hostedRuleIds.includes(ruleId) ? `hosted/${splitRuleId(ruleId).name}` : undefined;
}

const severityOf = (entry) => (Array.isArray(entry) ? entry[0] : entry);

function fixRules(rules = {}, isTypeScriptBlock = false) {
    const out = {};
    for (const [rule, entry] of Object.entries(rules)) {
        if (ALWAYS_HOSTED.has(rule)) {
            continue;
        }
        if (rule.startsWith('rulesdir/')) {
            // eslint-plugin-expensify rules need type information, which Oxlint JS plugins do not get.
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
            // Oxlint rejects ESLint's maxDepth "∞"; its own default is already unlimited.
            const {maxDepth, ...options} = entry[1] ?? {};
            out[rule] = maxDepth === '∞' ? [entry[0], options] : entry;
            continue;
        }
        if (rule === 'no-unused-vars' && isTypeScriptBlock && Array.isArray(entry)) {
            // typescript-eslint reports values used only as types; Oxlint does so only with this option.
            out[rule] = [entry[0], {...entry[1], reportVarsOnlyUsedAsTypes: true}];
            continue;
        }
        out[rule] = entry;
    }
    return out;
}

// The hosted eslint-plugin-import rules read these settings. Oxlint has no per-override settings, so every block's
// values are merged into one. `import/parsers` is left out because Oxlint parses every file itself.
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

// migrate puts jsPlugins inside overrides, but Oxlint accepts them only at the root.
function hoistedJsPlugins() {
    const specifiers = new Set([migrated, ...(migrated.overrides ?? [])].flatMap((block) => block.jsPlugins ?? []));
    specifiers.delete('eslint-plugin-rulesdir');
    return [...specifiers].map((specifier) => ({
        name: specifier.replace(/^eslint-plugin-/, ''),
        specifier: resolvePackage(specifier),
    }));
}

// When a later block sets only a severity, ESLint keeps the earlier options but Oxlint resets them to the
// defaults, so the earlier options are written out again.
function replayJsPluginRules() {
    const rules = {};
    const overrides = [];
    const scopedRules = new Set();
    const lastOptions = new Map();
    const filesKey = (files) => JSON.stringify(files ? [...files].sort() : null);
    const withEarlierOptions = (block, target, entry) => {
        const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
        if (options.length) {
            lastOptions.set(target, {files: filesKey(block.files), options});
            return entry;
        }
        const earlier = lastOptions.get(target);
        if (!earlier || ['off', 0].includes(severity)) {
            return entry;
        }
        if (earlier.files !== filesKey(null) && earlier.files !== filesKey(block.files)) {
            throw new Error(`${target} gets options for some files and a bare severity for others; Oxlint cannot express ESLint's merge`);
        }
        return [severity, ...earlier.options];
    };
    for (const block of eslintConfig) {
        const hits = Object.entries(block.rules ?? {}).flatMap(([ruleId, entry]) => {
            const target = jsPluginRuleFor(ruleId);
            return target ? [[target, withEarlierOptions(block, target, entry)]] : [];
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
        // ESLint detects the version; Oxlint needs it set.
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

export {STUBBED_PARSER_SERVICES, coreRuleNames, hostedRuleIds, oxlintConfig, pluginRules, splitRuleId};
