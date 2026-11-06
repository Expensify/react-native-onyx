// Oxlint has built-in plugins named react, import, jsdoc and typescript, so ESLint's versions of rules Oxlint lacks
// load here under the name `hosted`.
import {STUBBED_PARSER_SERVICES, hostedRuleIds, pluginRules, splitRuleId} from '../derive.mjs';

// typescript-eslint rules call getParserServices, which needs type information Oxlint plugins do not get. Called as
// getParserServices(context, true) it accepts a missing TypeScript program, but still reads these two maps and
// context.languageOptions, so they get empty placeholders.
const STUB_PARSER_SERVICES = {
    esTreeNodeToTSNodeMap: new Map(),
    tsNodeToESTreeNodeMap: new Map(),
};

function withStubbedParserServices(rule) {
    return {
        ...rule,
        create(context) {
            const sourceCode = context.sourceCode ?? context.getSourceCode();
            // Oxlint makes `parserServices` read-only, so a Proxy cannot replace it; a new object built on top can.
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
