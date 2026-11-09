// Runs on Node's test runner, not Jest: `npm run test:lint`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';

import {LINT_SEVERITY, applySeatbelt, canonicalizeMessages, parseSeatbeltTSV, resolveSeatbeltOptions, serializeSeatbeltTSV, transformMessages} from './seatbelt.mjs';

function makeOptions(overrides = {}) {
    return {
        seatbeltFile: '/tmp/config/oxlint/oxlint.seatbelt.tsv',
        projectRoot: '/tmp',
        disable: false,
        frozen: false,
        readOnly: true,
        allowIncreaseRules: new Set(),
        keepRules: new Set(),
        quiet: false,
        verbose: false,
        ...overrides,
    };
}

function makeMessage(ruleID, overrides = {}) {
    return {filePath: '/tmp/src/file.ts', ruleID, severity: LINT_SEVERITY.ERROR, message: `Original: ${ruleID}`, line: 1, column: 1, ...overrides};
}

describe('canonicalizeMessages', () => {
    it('sorts by filename, ruleID, line, then column', () => {
        const messages = [
            makeMessage('b', {filePath: '/z.ts', line: 2, column: 1}),
            makeMessage('a', {filePath: '/a.ts', line: 9, column: 1}),
            makeMessage('a', {filePath: '/a.ts', line: 1, column: 9}),
            makeMessage('a', {filePath: '/a.ts', line: 1, column: 1}),
        ];
        assert.deepEqual(
            canonicalizeMessages(messages).map((message) => `${message.filePath}:${message.ruleID}:${message.line}:${message.column}`),
            ['/a.ts:a:1:1', '/a.ts:a:1:9', '/a.ts:a:9:1', '/z.ts:b:2:1'],
        );
    });
});

describe('transformMessages', () => {
    it('demotes errors at the baseline to warnings', () => {
        const {data} = parseSeatbeltTSV(`"../../src/file.ts"\t"no-console"\t2\n`);
        const result = transformMessages(makeOptions(), data, '/tmp/src/file.ts', [makeMessage('no-console'), makeMessage('no-console', {line: 2})]);
        assert.equal(result.length, 2);
        assert.equal(result[0].severity, LINT_SEVERITY.WARNING);
        assert.match(result[0].message, /tend the garden/);
    });

    it('keeps overflow errors as errors', () => {
        const {data} = parseSeatbeltTSV(`"../../src/file.ts"\t"no-console"\t1\n`);
        const result = transformMessages(makeOptions(), data, '/tmp/src/file.ts', [
            makeMessage('no-console', {line: 1}),
            makeMessage('no-console', {line: 2}),
            makeMessage('no-console', {line: 3}),
        ]);
        assert.equal(result.filter((message) => message.severity === LINT_SEVERITY.ERROR).length, 2);
        assert.equal(result.filter((message) => message.severity === LINT_SEVERITY.WARNING).length, 1);
        assert.match(result.at(-1).message, /Remove/);
    });

    it('demotes the first N overflow occurrences, not an arbitrary subset', () => {
        const {data} = parseSeatbeltTSV(`"../../src/file.ts"\t"no-console"\t1\n`);
        const result = transformMessages(makeOptions(), data, '/tmp/src/file.ts', [makeMessage('no-console', {line: 10}), makeMessage('no-console', {line: 20})]);
        assert.equal(result[0].severity, LINT_SEVERITY.WARNING);
        assert.equal(result[0].line, 10);
        assert.equal(result[1].severity, LINT_SEVERITY.ERROR);
        assert.equal(result[1].line, 20);
    });

    it('quiet suppresses at-max warnings but keeps overflow errors', () => {
        const {data} = parseSeatbeltTSV(`"../../src/file.ts"\t"no-console"\t1\n`);
        const result = transformMessages(makeOptions({quiet: true}), data, '/tmp/src/file.ts', [makeMessage('no-console', {line: 1}), makeMessage('no-console', {line: 2})]);
        assert.equal(result.length, 1);
        assert.equal(result[0].severity, LINT_SEVERITY.ERROR);
    });

    it('frozen keeps a partial decrease as an error rather than writing', () => {
        const {data} = parseSeatbeltTSV(`"../../src/file.ts"\t"no-console"\t5\n`);
        const result = transformMessages(makeOptions({frozen: true}), data, '/tmp/src/file.ts', [makeMessage('no-console'), makeMessage('no-console', {line: 2})]);
        assert.equal(result[0].severity, LINT_SEVERITY.ERROR);
        assert.match(result[0].message, /SEATBELT_FROZEN/);
        assert.match(result[0].message, /oxlint\.seatbelt\.tsv/);
        assert.doesNotMatch(result[0].message, /\/tmp\/src\/file\.ts/);
    });

    it('leaves unbaselined rules untouched', () => {
        const {data} = parseSeatbeltTSV(`"../../src/file.ts"\t"no-console"\t1\n`);
        assert.deepEqual(transformMessages(makeOptions(), data, '/tmp/src/file.ts', [makeMessage('no-debugger')]), [makeMessage('no-debugger')]);
    });
});

describe('serializeSeatbeltTSV', () => {
    const rewriteThroughMaxErrors = (data) => {
        for (const fileState of data.values()) {
            fileState.maxErrors = new Map(fileState.lines.map((line) => [line.ruleID, line.maxErrors]));
        }
    };

    it('round-trips the committed header and row format', () => {
        const original = `# seatbelt temporarily allowed errors
# docs: config/oxlint/seatbelt.mjs

"../../src/a.ts"	"no-console"	1
"../../src/b.ts"	"typescript/no-deprecated"	2
`;
        const {data, comments} = parseSeatbeltTSV(original);
        rewriteThroughMaxErrors(data);
        assert.equal(serializeSeatbeltTSV(data, comments), original);
    });

    it('keeps per-row and trailing comments when rewriting counts', () => {
        const original = `# seatbelt temporarily allowed errors

"../../src/a.ts"	"no-console"	1
# tracked in Expensify/react-native-onyx#123
"../../src/b.ts"	"no-debugger"	2
# leftover
`;
        const {data, comments, trailingComments} = parseSeatbeltTSV(original);
        rewriteThroughMaxErrors(data);
        assert.equal(serializeSeatbeltTSV(data, comments, trailingComments), original);
    });
});

describe('applySeatbelt', () => {
    const dirs = [];
    afterEach(() => {
        for (const dir of dirs.splice(0)) {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });

    function setup(tsv, files = ['src.ts']) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-seatbelt-'));
        dirs.push(dir);
        for (const file of files) {
            fs.writeFileSync(path.join(dir, file), 'x\n');
        }
        const tsvPath = path.join(dir, 'oxlint.seatbelt.tsv');
        fs.writeFileSync(tsvPath, tsv);
        return {dir, tsvPath, file: (name) => path.join(dir, name)};
    }

    it('does not write in readOnly mode when counts go down', () => {
        const tsv = `"src.ts"\t"no-console"\t2\n`;
        const {dir, tsvPath, file} = setup(tsv);
        const result = applySeatbelt([makeMessage('no-console', {filePath: file('src.ts')})], makeOptions({seatbeltFile: tsvPath, projectRoot: dir, readOnly: true}), [file('src.ts')]);
        assert.equal(result.wrote, false);
        assert.equal(result.changed, true);
        assert.equal(fs.readFileSync(tsvPath, 'utf8'), tsv);
    });

    it('writes a tightened TSV when readOnly is off', () => {
        const {dir, tsvPath, file} = setup(`"src.ts"\t"no-console"\t2\n`);
        const result = applySeatbelt([makeMessage('no-console', {filePath: file('src.ts')})], makeOptions({seatbeltFile: tsvPath, projectRoot: dir, readOnly: false}), [file('src.ts')]);
        assert.equal(result.wrote, true);
        assert.match(result.tsv, /"src\.ts"\t"no-console"\t1/);
        assert.equal(fs.readFileSync(tsvPath, 'utf8'), result.tsv);
    });

    it('fails an increase without SEATBELT_INCREASE and does not write', () => {
        const original = `"src.ts"\t"no-console"\t1\n`;
        const {dir, tsvPath, file} = setup(original);
        const result = applySeatbelt(
            [makeMessage('no-console', {filePath: file('src.ts'), line: 1}), makeMessage('no-console', {filePath: file('src.ts'), line: 2})],
            makeOptions({seatbeltFile: tsvPath, projectRoot: dir, readOnly: false}),
            [file('src.ts')],
        );
        assert.equal(result.wrote, false);
        assert.ok(result.messages.some((message) => message.severity === LINT_SEVERITY.ERROR && message.message.includes('Remove')));
        assert.equal(fs.readFileSync(tsvPath, 'utf8'), original);
    });

    it('allows an increase when SEATBELT_INCREASE names the rule', () => {
        const {dir, tsvPath, file} = setup(`"src.ts"\t"no-console"\t1\n`);
        const result = applySeatbelt(
            [makeMessage('no-console', {filePath: file('src.ts'), line: 1}), makeMessage('no-console', {filePath: file('src.ts'), line: 2})],
            makeOptions({seatbeltFile: tsvPath, projectRoot: dir, readOnly: false, allowIncreaseRules: new Set(['no-console'])}),
            [file('src.ts')],
        );
        assert.equal(result.wrote, true);
        assert.match(result.tsv, /"src\.ts"\t"no-console"\t2/);
        assert.ok(result.messages.every((message) => message.severity === LINT_SEVERITY.WARNING));
    });

    it('prunes rows for deleted files on the write path', () => {
        const {dir, tsvPath, file} = setup(`"gone.ts"\t"no-console"\t1\n"kept.ts"\t"no-console"\t1\n`, ['kept.ts']);
        const result = applySeatbelt([makeMessage('no-console', {filePath: file('kept.ts')})], makeOptions({seatbeltFile: tsvPath, projectRoot: dir, readOnly: false}), [file('kept.ts')]);
        assert.equal(result.wrote, true);
        assert.doesNotMatch(result.tsv, /gone\.ts/);
        assert.match(result.tsv, /kept\.ts/);
    });

    it('does not prune deleted-file rows when frozen', () => {
        const original = `"gone.ts"\t"no-console"\t1\n"kept.ts"\t"no-console"\t1\n`;
        const {dir, tsvPath, file} = setup(original, ['kept.ts']);
        const result = applySeatbelt([makeMessage('no-console', {filePath: file('kept.ts')})], makeOptions({seatbeltFile: tsvPath, projectRoot: dir, frozen: true, readOnly: false}), [
            file('kept.ts'),
        ]);
        assert.equal(result.wrote, false);
        assert.equal(fs.readFileSync(tsvPath, 'utf8'), original);
    });

    it('names the TSV path when a frozen run drops a rule entirely', () => {
        const {dir, tsvPath, file} = setup(`"kept.ts"\t"no-console"\t1\n`, ['kept.ts']);
        const result = applySeatbelt([], makeOptions({seatbeltFile: tsvPath, projectRoot: dir, frozen: true, readOnly: false}), [file('kept.ts')]);
        assert.ok(result.messages.some((message) => message.message.includes(tsvPath) && message.message.includes('SEATBELT_FROZEN')));
        assert.ok(!result.messages.some((message) => message.message.includes('kept.ts') && !message.message.includes(tsvPath)));
    });

    it('is a no-op when SEATBELT_DISABLE is set', () => {
        const {tsvPath} = setup(`"src.ts"\t"no-console"\t1\n`);
        const incoming = [makeMessage('no-console')];
        const result = applySeatbelt(incoming, makeOptions({seatbeltFile: tsvPath, disable: true}), ['/tmp/src/file.ts']);
        assert.equal(result.messages, incoming);
        assert.equal(result.wrote, false);
    });
});

describe('resolveSeatbeltOptions', () => {
    it('reads only outside CI, writes in CI, and is never frozen by default', () => {
        assert.equal(resolveSeatbeltOptions('/repo', {}).readOnly, true);
        assert.equal(resolveSeatbeltOptions('/repo', {CI: 'true'}).readOnly, false);
        assert.equal(resolveSeatbeltOptions('/repo', {CI: 'true'}).frozen, false);
    });

    it('lets SEATBELT_FROZEN freeze and SEATBELT_INCREASE force writes', () => {
        assert.equal(resolveSeatbeltOptions('/repo', {SEATBELT_FROZEN: '1'}).frozen, true);
        assert.equal(resolveSeatbeltOptions('/repo', {SEATBELT_READ_ONLY: '1', SEATBELT_INCREASE: 'no-console'}).readOnly, false);
        assert.equal(resolveSeatbeltOptions('/repo', {SEATBELT_INCREASE: 'all'}).allowIncreaseRules, 'all');
    });
});
