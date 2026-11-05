/**
 * Runs rules from ESLint plugins (typescript-eslint, import, jsdoc, react) inside Oxlint, using the plugins'
 * own code, for rules Oxlint has no native version of. Oxlint reserves those plugin names for its own
 * ports, so all of them load under `hosted`; config/oxlint/ruleNames.mjs maps them back to ESLint ids.
 * Adapted from Expensify/App config/oxlint/plugins/hosted-rules.mjs (React Compiler gating removed).
 */
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {withEslintDirectiveIDsFor} from '../eslintDirectives.mjs';
import {hostedRuleNames} from '../ruleNames.mjs';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Loads the rules of an installed ESLint plugin, so Oxlint runs the same rule code as ESLint.
 * @param {string} packageName
 * @returns {Record<string, import('eslint').Rule.RuleModule>}
 */
function rulesOf(packageName) {
    const mod = require(require.resolve(packageName, {paths: [repoRoot]}));
    return mod?.rules ?? mod?.default?.rules ?? {};
}

const react = rulesOf('eslint-plugin-react');
const importPlugin = rulesOf('eslint-plugin-import');
const jsdoc = rulesOf('eslint-plugin-jsdoc');
const typescriptEslint = rulesOf('@typescript-eslint/eslint-plugin');

// naming-convention asks for parser services, which Oxlint JS plugins lack. getParserServices(context, true)
// tolerates a missing `program` but fails on missing node maps and reads context.languageOptions first, so
// both are stubbed. Onyx's naming-convention options use no `types` selector, so the type checker is never hit.
const STUB_PARSER_SERVICES = {
    esTreeNodeToTSNodeMap: new Map(),
    tsNodeToESTreeNodeMap: new Map(),
};

/**
 * @param {import('eslint').Rule.RuleModule} rule
 * @returns {import('eslint').Rule.RuleModule}
 */
function withStubbedParserServices(rule) {
    return {
        ...rule,
        create(context) {
            const sourceCode = context.sourceCode ?? context.getSourceCode();
            // A Proxy cannot do this: Oxlint defines `parserServices` as read-only and non-configurable.
            const stubbedSourceCode = Object.create(sourceCode, {
                parserServices: {value: STUB_PARSER_SERVICES},
            });
            const stubbedContext = Object.create(context, {
                sourceCode: {value: stubbedSourceCode},
                getSourceCode: {value: () => stubbedSourceCode},
                languageOptions: {
                    value: context.languageOptions ?? {parser: {meta: {name: 'oxlint-js-plugin'}}},
                },
            });
            return rule.create(stubbedContext);
        },
    };
}

/**
 * Picks `names` from an ESLint plugin and makes `eslint-disable` comments that use the ESLint id
 * (`<eslintPrefix>/<name>`) apply to them.
 * @param {Record<string, import('eslint').Rule.RuleModule>} rules
 * @param {string} eslintPrefix
 * @returns {Record<string, import('eslint').Rule.RuleModule>}
 */
function hostRules(rules, eslintPrefix) {
    const names = hostedRuleNames(eslintPrefix);
    for (const name of names) {
        if (!rules[name]) {
            throw new Error(`${eslintPrefix}/${name} not found in the installed ESLint plugin`);
        }
    }
    return withEslintDirectiveIDsFor(Object.fromEntries(names.map((name) => [name, rules[name]])), (name) => `${eslintPrefix}/${name}`);
}

const plugin = {
    meta: {
        name: 'hosted',
        version: '0.0.1',
    },
    rules: {
        ...hostRules(react, 'react'),
        ...hostRules(importPlugin, 'import'),
        ...hostRules(jsdoc, 'jsdoc'),
        ...hostRules({'naming-convention': withStubbedParserServices(typescriptEslint['naming-convention'])}, '@typescript-eslint'),
    },
};

export default plugin;
