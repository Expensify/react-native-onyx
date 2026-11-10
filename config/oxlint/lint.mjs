// Runs Oxlint, applies the seatbelt (seatbelt.mjs) and prints the result.
//
//   npm run lint                          lint the whole repo
//   npm run lint -- lib/Onyx.ts tests     lint the given paths
//   npm run lint -- --show-warnings       also print the grandfathered warnings
//   npm run lint -- --format=json         print a JSON report
//   npm run lint -- --fix                 apply Oxlint's auto-fixes
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

import {LINT_SEVERITY, applySeatbelt, resolveSeatbeltOptions} from './seatbelt.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Called directly rather than through npx, which passes the whole command line to `sh -c` as one string.
const OXLINT_BIN = path.join(projectRoot, 'node_modules', '.bin', 'oxlint');
const FATAL_EXIT_CODE = 2;
const JS_PLUGIN_CRASH_MESSAGE = 'Error running JS plugin';

function fail(reason, output = '') {
    console.error([reason, output.trim().slice(0, 2000)].filter(Boolean).join('\n'));
    process.exit(FATAL_EXIT_CODE);
}

function runOxlint(args) {
    const result = spawnSync(OXLINT_BIN, args, {cwd: projectRoot, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024});
    if (result.error) {
        fail(`Could not run ${OXLINT_BIN}: ${result.error.message}`);
    }
    return {stdout: result.stdout ?? '', stderr: result.stderr ?? '', exitCode: result.status ?? FATAL_EXIT_CODE};
}

// Oxlint's JSON report leaves out files without findings, and the seatbelt needs them to notice fixed errors.
function listLintedFiles(targets) {
    return runOxlint(['--debug=files', ...targets])
        .stdout.split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((file) => path.resolve(projectRoot, file));
}

// `typescript(no-explicit-any)` becomes `typescript/no-explicit-any` and `eslint(no-undef)` becomes `no-undef`,
// the names oxlint.config uses, so baseline rows can be matched to config and disable comments by name.
function toRuleID(code) {
    const match = /^([\w@/.-]+)\((.+)\)$/.exec(code);
    if (!match) {
        return code;
    }
    return match[1] === 'eslint' ? match[2] : `${match[1]}/${match[2]}`;
}

function toLintMessage(diagnostic) {
    const span = diagnostic.labels?.[0]?.span;
    const text = [diagnostic.message, diagnostic.help, diagnostic.note].filter(Boolean).join('\n');
    return {
        filePath: path.resolve(projectRoot, diagnostic.filename),
        ruleID: diagnostic.code ? toRuleID(diagnostic.code) : null,
        severity: ['warning', 'advice'].includes(diagnostic.severity) ? LINT_SEVERITY.WARNING : LINT_SEVERITY.ERROR,
        // A diagnostic without a rule is a file Oxlint could not parse.
        message: diagnostic.code ? text : `Parsing error: ${text}`,
        line: span?.line ?? 0,
        column: span?.column ?? 0,
    };
}

function lint(targets, fix) {
    const {stdout, stderr, exitCode} = runOxlint(['--type-aware', '--format', 'json', ...(fix ? ['--fix'] : []), ...targets]);
    // Oxlint exits 1 for findings. Anything higher, or no JSON at all, means it crashed or rejected the config.
    const start = stdout.indexOf('{');
    const end = stdout.lastIndexOf('}');
    if (exitCode > 1 || start < 0 || end <= start) {
        fail(`Oxlint failed (exit ${exitCode}).`, `${stderr}\n${stdout}`);
    }
    let report;
    try {
        report = JSON.parse(stdout.slice(start, end + 1));
    } catch {
        fail('Could not parse Oxlint JSON output.', stdout);
    }
    if (!Array.isArray(report?.diagnostics)) {
        fail('Oxlint JSON output has no `diagnostics` array.', stdout);
    }
    // A JS plugin crash also has no rule, but no location either. It would hide every JS plugin finding in the
    // file, so it fails the run instead of passing as a parse error.
    const crashes = report.diagnostics.filter((diagnostic) => !diagnostic.code && (diagnostic.message.startsWith(JS_PLUGIN_CRASH_MESSAGE) || !diagnostic.labels?.length));
    if (crashes.length) {
        fail(
            `Oxlint reported ${crashes.length} JS plugin crash(es):`,
            crashes
                .slice(0, 5)
                .map((diagnostic) => `  ${diagnostic.filename}: ${diagnostic.message.split('\n').slice(0, 3).join(' ')}`)
                .join('\n'),
        );
    }
    return report.diagnostics.map(toLintMessage);
}

function formatStylish(messages, errorCount, warningCount, showWarnings) {
    const visible = showWarnings ? messages : messages.filter((message) => message.severity === LINT_SEVERITY.ERROR);
    const lines = visible.map((message) => {
        const location = `${path.relative(projectRoot, message.filePath)}:${message.line}:${message.column}`;
        const level = message.severity === LINT_SEVERITY.ERROR ? 'error' : 'warning';
        return `${location}\n  ${level}  ${message.message}${message.ruleID ? `  ${message.ruleID}` : ''}`;
    });
    const summary = `${errorCount} error${errorCount === 1 ? '' : 's'}${showWarnings ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}`;
    return [...lines, summary].join('\n\n');
}

const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
        'show-warnings': {type: 'boolean', default: false},
        format: {type: 'string', default: 'stylish'},
        fix: {type: 'boolean', default: false},
    },
});
if (!['stylish', 'json'].includes(values.format)) {
    fail(`Unknown format "${values.format}". Expected stylish or json.`);
}

const targets = positionals.length ? positionals : ['.'];
const lintedFiles = listLintedFiles(targets);
if (!lintedFiles.length) {
    fail(`Oxlint matched no files for: ${targets.join(' ')}`);
}

const {messages} = applySeatbelt(lint(targets, values.fix), resolveSeatbeltOptions(projectRoot), lintedFiles);
const errorCount = messages.filter((message) => message.severity === LINT_SEVERITY.ERROR).length;
const warningCount = messages.length - errorCount;
if (values.format === 'json') {
    console.log(JSON.stringify({messages, errorCount, warningCount}));
} else {
    console.log(formatStylish(messages, errorCount, warningCount, values['show-warnings']));
}
process.exitCode = errorCount > 0 ? 1 : 0;
