/**
 * ESLint core rules that Oxlint has no native (non-nursery) version of. They run inside Oxlint as a JS
 * plugin under the `core/` prefix, using ESLint's own rule code, and respect `eslint-disable` comments
 * written with the ESLint rule id. config/oxlint/derive.mjs picks the rules and the files each one runs on.
 * Adapted from Expensify/App config/oxlint/plugins/core-rules.mjs.
 *
 * no-invalid-this is left out (see NOT_PORTED in derive.mjs).
 */
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
