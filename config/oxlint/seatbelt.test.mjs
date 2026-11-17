// Runs on Node's test runner, not Jest: `npm run test:lint`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';

import {LINT_SEVERITY, applySeatbelt, resolveSeatbeltOptions} from './seatbelt.mjs';

const dirs = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

// Writes the baseline into a temp dir and applies it to findings given as [ruleID, line, file = 'src.ts'].
function run(tsv, findings, {files = ['src.ts'], ...overrides} = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-seatbelt-'));
    dirs.push(dir);
    for (const file of files) {
        fs.writeFileSync(path.join(dir, file), 'x\n');
    }
    const seatbeltFile = path.join(dir, 'oxlint.seatbelt.tsv');
    fs.writeFileSync(seatbeltFile, tsv);

    const messages = findings.map(([ruleID, line, file = 'src.ts']) => ({
        filePath: path.join(dir, file),
        ruleID,
        severity: LINT_SEVERITY.ERROR,
        message: `Original: ${ruleID}`,
        line,
        column: 1,
    }));
    const options = {...resolveSeatbeltOptions(dir, {}), seatbeltFile, ...overrides};
    const result = applySeatbelt(
        messages,
        options,
        files.map((file) => path.join(dir, file)),
    );
    return {...result, seatbeltFile, onDisk: fs.readFileSync(seatbeltFile, 'utf8')};
}

const summarize = (messages) => messages.map((message) => `${message.ruleID}:${message.line}:${message.severity === LINT_SEVERITY.ERROR ? 'error' : 'warning'}`);

describe('applySeatbelt', () => {
    it('demotes errors up to the baseline, in file order, and leaves other errors alone', () => {
        const {messages} = run(`"src.ts"\t"no-console"\t1\n`, [
            ['no-console', 20],
            ['no-debugger', 5],
            ['no-console', 10],
        ]);
        assert.deepEqual(summarize(messages), ['no-console:10:warning', 'no-console:20:error', 'no-debugger:5:error']);
    });

    it('hides the demoted warnings when quiet', () => {
        const {messages} = run(`"src.ts"\t"no-console"\t1\n`, [['no-console', 1]], {quiet: true});
        assert.deepEqual(messages, []);
    });

    it('fails on any difference when frozen, and neither writes nor prunes', () => {
        const tsv = `"gone.ts"\t"no-console"\t1\n"src.ts"\t"no-console"\t5\n"src.ts"\t"no-debugger"\t1\n`;
        const {messages, onDisk, seatbeltFile} = run(
            tsv,
            [
                ['no-console', 1],
                ['no-console', 2],
            ],
            {frozen: true, readOnly: false},
        );
        assert.ok(messages.length > 0);
        assert.ok(messages.every((message) => message.severity === LINT_SEVERITY.ERROR && message.message.includes('SEATBELT_FROZEN')));
        assert.ok(messages.some((message) => message.ruleID === 'no-debugger' && message.message.includes(seatbeltFile)));
        assert.equal(onDisk, tsv);
    });

    it('writes tightened counts and keeps comments in CI, but not when read-only', () => {
        const tsv = `# header

"src.ts"\t"no-console"\t2
# tracked in an issue
"src.ts"\t"no-debugger"\t2
# trailing
`;
        const findings = [
            ['no-console', 1],
            ['no-debugger', 1],
            ['no-debugger', 2],
        ];

        const ci = run(tsv, findings, {readOnly: false});
        assert.equal(ci.onDisk, tsv.replace(`"no-console"\t2`, `"no-console"\t1`));

        const local = run(tsv, findings, {readOnly: true});
        assert.equal(local.onDisk, tsv);
    });

    it('fails an increase without SEATBELT_INCREASE and does not write', () => {
        const tsv = `"src.ts"\t"no-console"\t1\n`;
        const {messages, onDisk} = run(
            tsv,
            [
                ['no-console', 1],
                ['no-console', 2],
            ],
            {readOnly: false},
        );
        assert.deepEqual(summarize(messages), ['no-console:1:warning', 'no-console:2:error']);
        assert.equal(onDisk, tsv);
    });

    it('records an increase when SEATBELT_INCREASE names the rule', () => {
        const {messages, onDisk} = run(
            `# header\n\n"src.ts"\t"no-console"\t1\n`,
            [
                ['no-console', 1],
                ['no-console', 2],
            ],
            {readOnly: false, allowIncreaseRules: new Set(['no-console'])},
        );
        assert.ok(messages.every((message) => message.severity === LINT_SEVERITY.WARNING));
        assert.equal(onDisk, `# header\n\n"src.ts"\t"no-console"\t2\n`);
    });

    it('drops rows for deleted files', () => {
        const {onDisk} = run(`# header\n\n"gone.ts"\t"no-console"\t1\n"src.ts"\t"no-console"\t1\n`, [['no-console', 1]], {readOnly: false});
        assert.equal(onDisk, `# header\n\n"src.ts"\t"no-console"\t1\n`);
    });

    it('does nothing when disabled', () => {
        const tsv = `"src.ts"\t"no-console"\t1\n`;
        const {messages, onDisk} = run(tsv, [['no-console', 1]], {disable: true, readOnly: false});
        assert.deepEqual(summarize(messages), ['no-console:1:error']);
        assert.equal(onDisk, tsv);
    });
});

describe('resolveSeatbeltOptions', () => {
    it('reads only outside CI, writes in CI, and SEATBELT_INCREASE forces writes', () => {
        assert.equal(resolveSeatbeltOptions('/repo', {}).readOnly, true);
        assert.equal(resolveSeatbeltOptions('/repo', {CI: 'true'}).readOnly, false);
        assert.equal(resolveSeatbeltOptions('/repo', {SEATBELT_READ_ONLY: '1', SEATBELT_INCREASE: 'no-console'}).readOnly, false);
    });
});
