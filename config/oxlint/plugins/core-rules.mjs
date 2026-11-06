// Oxlint has no native version of these ESLint core rules, so it runs ESLint's own code for them.
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {coreRuleNames} from '../derive.mjs';

const plugin = {
    meta: {
        name: 'core',
        version: '0.0.1',
    },
    rules: Object.fromEntries(coreRuleNames.map((name) => [name, builtinRules.get(name)])),
};

export default plugin;
