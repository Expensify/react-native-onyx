/**
 * Loads every rule from eslint-config-expensify's eslint-plugin-expensify into Oxlint under the `rulesdir`
 * name ESLint uses, so `rulesdir/<rule>` ids and `eslint-disable` comments stay the same.
 * Adapted from Expensify/App config/oxlint/plugins/expensify-rules.mjs.
 *
 * Rules that call `ESLintUtils.getParserServices` (type-aware rules such as `prefer-at` and
 * `boolean-conditional-rendering`) cannot run here: Oxlint JS plugins get no TypeScript program.
 * They are detected by source, collected in TYPE_AWARE_RULES and not registered; `oxlint.config.mts` uses a
 * native stand-in where one exists.
 */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const RULES_DIR = path.join(path.dirname(require.resolve('eslint-config-expensify')), 'eslint-plugin-expensify');

const HELPER_FILES = new Set(['CONST.js']);

/** Rules whose source needs TypeScript parser services. Kept in sync by hand with eslint-plugin-expensify. */
const TYPE_AWARE_RULES = new Set();

const rules = {};
for (const file of fs.readdirSync(RULES_DIR)) {
    if (!file.endsWith('.js') || HELPER_FILES.has(file)) {
        continue;
    }
    const name = file.replace(/\.js$/, '');
    const source = fs.readFileSync(path.join(RULES_DIR, file), 'utf8');
    if (source.includes('getParserServices')) {
        TYPE_AWARE_RULES.add(name);
        continue;
    }
    const mod = await import(pathToFileURL(path.join(RULES_DIR, file)).href);
    rules[name] = mod.default ?? {meta: mod.meta, create: mod.create};
}

const plugin = {
    meta: {
        name: 'rulesdir',
        version: '0.0.1',
    },
    rules,
};

export {TYPE_AWARE_RULES};
export default plugin;
