/**
 * ESLint core rules that Oxlint has no native (non-nursery) version of. They run inside Oxlint as a JS
 * plugin under the `core/` prefix, using ESLint's own rule code, and respect `eslint-disable` comments
 * written with the ESLint rule id. Which files each one runs on is set in oxlint.config.mts, copying ESLint.
 * Adapted from Expensify/App config/oxlint/plugins/core-rules.mjs.
 *
 * no-invalid-this is left out, as in App: it calls sourceCode.getJSDocComment, which Oxlint's plugin
 * bridge does not support.
 */
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {withEslintDirectiveIDsFor} from '../eslintDirectives.mjs';

const NAMES = [
    'no-restricted-syntax',
    'lines-between-class-members',
    'no-octal',
    'no-octal-escape',
    'no-undef-init',
    'strict',
    'no-dupe-args',
    'no-return-await',
    'no-new-symbol',
    'no-new-object',
    'no-unreachable-loop',
    'no-restricted-exports',
    'no-undef',
];

const plugin = {
    meta: {
        name: 'core',
        version: '0.0.1',
    },
    rules: withEslintDirectiveIDsFor(Object.fromEntries(NAMES.map((name) => [name, builtinRules.get(name)])), (name) => name),
};

export default plugin;
