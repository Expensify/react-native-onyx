/**
 * Runs rules from ESLint plugins (typescript-eslint, import, jsdoc, react) inside Oxlint, using the plugins'
 * own code, for rules Oxlint has no native version of. Oxlint reserves those plugin names for its own
 * ports, so all of them load under `hosted`; HOSTED_RULE_ORIGIN in config/oxlint/derive.mjs maps them back.
 * config/oxlint/derive.mjs picks the rules. Adapted from Expensify/App config/oxlint/plugins/hosted-rules.mjs.
 */
import {STUBBED_PARSER_SERVICES, hostedRuleIds, pluginRules, splitRuleId} from '../derive.mjs';
import {withEslintDirectiveIDs} from '../eslintDirectives.mjs';

// Type-checked rules such as naming-convention ask for parser services, which Oxlint JS plugins lack. getParserServices(context, true)
// tolerates a missing `program` but fails on missing node maps and reads context.languageOptions first, so
// both are stubbed. Only rules listed in STUBBED_PARSER_SERVICES get this, because they never reach the type checker.
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

const plugin = {
    meta: {
        name: 'hosted',
        version: '0.0.1',
    },
    rules: Object.fromEntries(
        hostedRuleIds.map((ruleId) => {
            const {prefix, name} = splitRuleId(ruleId);
            const rule = pluginRules(prefix)[name];
            // Makes `eslint-disable` comments that use the ESLint id apply to the hosted rule.
            return [name, withEslintDirectiveIDs(STUBBED_PARSER_SERVICES.has(ruleId) ? withStubbedParserServices(rule) : rule, ruleId)];
        }),
    ),
};

export default plugin;
