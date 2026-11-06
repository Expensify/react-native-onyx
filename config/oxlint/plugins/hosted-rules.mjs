// Oxlint reserves the react, import, jsdoc and typescript plugin names for its own ports, so the ESLint versions
// of rules it lacks load here under `hosted`.
import {STUBBED_PARSER_SERVICES, hostedRuleIds, pluginRules, splitRuleId} from '../derive.mjs';

// Oxlint gives JS plugins no TypeScript program. typescript-eslint's getParserServices(context, true) accepts a
// missing program but still needs the node maps and reads context.languageOptions, so both are stubbed.
const STUB_PARSER_SERVICES = {
    esTreeNodeToTSNodeMap: new Map(),
    tsNodeToESTreeNodeMap: new Map(),
};

function withStubbedParserServices(rule) {
    return {
        ...rule,
        create(context) {
            const sourceCode = context.sourceCode ?? context.getSourceCode();
            // Not a Proxy: Oxlint makes `parserServices` read-only and non-configurable.
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
            return [name, STUBBED_PARSER_SERVICES.has(ruleId) ? withStubbedParserServices(rule) : rule];
        }),
    ),
};

export default plugin;
