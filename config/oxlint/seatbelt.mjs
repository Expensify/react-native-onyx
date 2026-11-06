// config/oxlint/oxlint.seatbelt.tsv records, per file and rule, how many errors are allowed. Errors up to that count
// report as warnings; one more fails the run. Counts can only go down, unless SEATBELT_INCREASE names the rule.
//
// Local runs only read the file, so fixing errors leaves the working tree clean. CI writes it, and the lint job on
// main commits the tightened file back as os-botify (.github/workflows/lint.yml).
//
// Env: SEATBELT_INCREASE=<rules|all> allows and records an increase (commit the file with your change),
// SEATBELT_READ_ONLY=0 writes locally, SEATBELT_FROZEN=1 fails on any difference from the file, SEATBELT_KEEP=<rules|all>
// keeps rows that reached zero, SEATBELT_DISABLE=1 turns it off, SEATBELT_QUIET=1 hides the grandfathered warnings,
// SEATBELT_VERBOSE=1 logs every decision.
import fs from 'node:fs';
import path from 'node:path';

const SEATBELT_NAME = 'seatbelt';
const SEATBELT_TSV_RELATIVE = 'config/oxlint/oxlint.seatbelt.tsv';
const DEFAULT_FILE_HEADER = `# ${SEATBELT_NAME} temporarily allowed errors
# docs: config/oxlint/seatbelt.mjs`;

const LINT_SEVERITY = {WARNING: 1, ERROR: 2};

const toRelativePath = (baseFile, filename) => (path.isAbsolute(filename) ? path.relative(path.dirname(baseFile), filename) : filename);
const toAbsolutePath = (baseFile, filename) => (path.isAbsolute(filename) ? filename : path.resolve(path.dirname(baseFile), filename));

// Each data line holds tab-separated JSON values. Comments before the first row are the header, comments after the
// last row are trailing, and any other comment travels with the row below it when rows are sorted.
function parseTSV(text) {
    const rows = [];
    const leading = [];
    const pending = [];
    let seenData = false;
    for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
        if (!/\S/.test(rawLine)) {
            continue;
        }
        if (/^\s*#/.test(rawLine)) {
            (seenData ? pending : leading).push(rawLine);
            continue;
        }
        const cells = rawLine.split('\t').map((cell, column) => {
            try {
                return JSON.parse(cell);
            } catch {
                throw new Error(`Invalid JSON in column ${column + 1} at line ${index + 1}`);
            }
        });
        rows.push({cells, comments: pending.join('\n')});
        pending.length = 0;
        seenData = true;
    }
    return {leadingComments: leading.join('\n'), trailingComments: pending.join('\n'), rows};
}

function serializeTSV({leadingComments, trailingComments, rows}) {
    const appendBlock = (output, block) => (block ? output + (block.endsWith('\n') ? block : `${block}\n`) : output);
    const items = rows.map((row) => ({comments: row.comments, encoded: `${row.cells.map((cell) => JSON.stringify(cell)).join('\t')}\n`}));
    items.sort((left, right) => left.encoded.localeCompare(right.encoded));
    let output = leadingComments ? `${appendBlock('', leadingComments)}\n` : '';
    for (const item of items) {
        output = appendBlock(output, item.comments) + item.encoded;
    }
    return appendBlock(output, trailingComments);
}

const ruleSetHas = (ruleSet, ruleID) => ruleSet === 'all' || ruleSet.has(ruleID);

function asSeatbeltLine(row, lineNumber) {
    if (row.length !== 3) {
        throw new Error(`Expected 3 tab-separated JSON values at line ${lineNumber}, instead have ${row.length}`);
    }
    const [filename, ruleID, maxErrors] = row;
    if (typeof filename !== 'string' || typeof ruleID !== 'string' || typeof maxErrors !== 'number') {
        throw new Error(`Expected "file"<tab>"rule"<tab>count at line ${lineNumber}`);
    }
    return {filename, ruleID, maxErrors, comments: ''};
}

function parseSeatbeltTSV(text) {
    const parsed = parseTSV(text);
    const data = new Map();
    for (const [index, row] of parsed.rows.entries()) {
        const line = asSeatbeltLine(row.cells, index + 1);
        line.comments = row.comments;
        const fileState = data.get(line.filename) ?? {maxErrors: undefined, lines: []};
        fileState.lines.push(line);
        data.set(line.filename, fileState);
    }
    return {data, comments: parsed.leadingComments, trailingComments: parsed.trailingComments};
}

function serializeSeatbeltTSV(data, comments, trailingComments = '') {
    const rows = [];
    for (const [filename, fileState] of data) {
        if (fileState.maxErrors) {
            const commentsByRule = new Map(fileState.lines.map((line) => [line.ruleID, line.comments]));
            fileState.lines = [...fileState.maxErrors].map(([ruleID, maxErrors]) => ({filename, ruleID, maxErrors, comments: commentsByRule.get(ruleID) ?? ''}));
        }
        for (const line of fileState.lines) {
            rows.push({cells: [line.filename, line.ruleID, line.maxErrors], comments: line.comments});
        }
    }
    return serializeTSV({leadingComments: comments, trailingComments, rows});
}

function getMaxErrors(data, relativeFilename) {
    const fileState = data.get(relativeFilename);
    if (!fileState) {
        return undefined;
    }
    fileState.maxErrors ??= new Map(fileState.lines.map((line) => [line.ruleID, line.maxErrors]));
    return fileState.maxErrors;
}

const isCountableError = (message) => message.severity === LINT_SEVERITY.ERROR && !!message.ruleID;

function countRuleIDs(messages) {
    const counts = new Map();
    for (const message of messages) {
        if (isCountableError(message)) {
            counts.set(message.ruleID, (counts.get(message.ruleID) ?? 0) + 1);
        }
    }
    return counts;
}

const pluralErrors = (count) => (count === 1 ? 'error' : 'errors');

function compareMessages(a, b) {
    if (a.filePath !== b.filePath) {
        return a.filePath < b.filePath ? -1 : 1;
    }
    if (a.ruleID !== b.ruleID) {
        if (a.ruleID === null) {
            return -1;
        }
        if (b.ruleID === null) {
            return 1;
        }
        return a.ruleID < b.ruleID ? -1 : 1;
    }
    return a.line - b.line || a.column - b.column;
}

// Sorted by file, rule, line and column, so "the first N of M errors" are the same ones on every run.
const canonicalizeMessages = (messages) => [...messages].sort(compareMessages);

function verboseLog(options, makeMessage) {
    if (options.verbose) {
        console.error(`[${SEATBELT_NAME}]:`, makeMessage());
    }
}

const withNote = (message, note, severity = message.severity) => ({...message, severity, message: `${message.message}\n[${SEATBELT_NAME}]: ${note}`});

function frozenText(seatbeltFilename, errorCount, maxErrorCount) {
    const fixed = maxErrorCount - errorCount;
    return `[${SEATBELT_NAME}]: SEATBELT_FROZEN: Expected ${maxErrorCount} ${pluralErrors(maxErrorCount)}, found ${errorCount}.
If you fixed ${fixed} ${fixed === 1 ? 'error' : 'errors'}, thank you, but you'll need to update the seatbelt file to match.
Try running npm run lint, then committing ${seatbeltFilename}.`;
}

function transformMessages(options, data, filename, messages) {
    const ruleToMaxErrorCount = getMaxErrors(data, toRelativePath(options.seatbeltFile, filename));
    const allowIncrease = options.allowIncreaseRules === 'all' || options.allowIncreaseRules.size > 0;
    if (!ruleToMaxErrorCount && !allowIncrease) {
        return messages;
    }

    const ruleToErrorCount = countRuleIDs(messages);
    const demoteRemaining = new Map();
    const seenVerbose = new Set();
    const logOnce = (ruleID, text) => {
        if (options.verbose && !seenVerbose.has(ruleID)) {
            seenVerbose.add(ruleID);
            verboseLog(options, () => `${filename}: rule ${ruleID}: ${text}`);
        }
    };

    return messages.flatMap((message) => {
        if (!isCountableError(message)) {
            return message;
        }
        const errorCount = ruleToErrorCount.get(message.ruleID);
        const maxErrorCount = ruleToMaxErrorCount?.get(message.ruleID) ?? 0;
        const allowThisIncrease = ruleSetHas(options.allowIncreaseRules, message.ruleID);
        if (maxErrorCount === 0 && !allowThisIncrease) {
            return message;
        }

        if (errorCount > maxErrorCount) {
            if (allowThisIncrease) {
                const increase = errorCount - maxErrorCount;
                return options.quiet ? [] : withNote(message, `SEATBELT_INCREASE: Temporarily allowing ${increase} new ${pluralErrors(increase)} of this type.`, LINT_SEVERITY.WARNING);
            }
            logOnce(message.ruleID, `error: ${errorCount} ${pluralErrors(errorCount)} found > max ${maxErrorCount}`);
            const remaining = demoteRemaining.get(message.ruleID) ?? maxErrorCount;
            if (remaining > 0) {
                demoteRemaining.set(message.ruleID, remaining - 1);
                return options.quiet
                    ? []
                    : withNote(
                          message,
                          `This file is temporarily allowed to have ${maxErrorCount} ${pluralErrors(maxErrorCount)} of this type.\nPlease tend the garden by fixing if you have the time.`,
                          LINT_SEVERITY.WARNING,
                      );
            }
            return withNote(
                message,
                `There are ${errorCount} ${pluralErrors(errorCount)} of this type, but only ${maxErrorCount} are allowed.\nRemove ${
                    errorCount - maxErrorCount
                } to turn these errors into warnings.`,
            );
        }

        if (errorCount === maxErrorCount) {
            logOnce(message.ruleID, `ok: ${errorCount} ${pluralErrors(errorCount)} found == max ${maxErrorCount}`);
            return options.quiet
                ? []
                : withNote(
                      message,
                      `This file is temporarily allowed to have ${errorCount} ${pluralErrors(errorCount)} of this type.\nPlease tend the garden by fixing if you have the time.`,
                      LINT_SEVERITY.WARNING,
                  );
        }

        if (options.frozen) {
            // Frozen fails on any difference, so a decrease that has not reached zero still blocks the run.
            return {...message, severity: LINT_SEVERITY.ERROR, message: `${message.message}\n${frozenText(options.seatbeltFile, errorCount, maxErrorCount)}`};
        }
        const fixed = maxErrorCount - errorCount;
        return options.quiet
            ? []
            : withNote(
                  message,
                  `This file is temporarily allowed to have ${maxErrorCount} ${pluralErrors(maxErrorCount)} of this type.\nThank you for fixing ${
                      fixed === 1 ? 'one' : `${fixed} errors`
                  }, it really helps.`,
                  LINT_SEVERITY.WARNING,
              );
    });
}

function updateMaxErrors(options, data, filename, ruleToErrorCount) {
    const removedRules = new Set();
    let changedRules = 0;
    const relativeFilename = toRelativePath(options.seatbeltFile, filename);
    const maxErrors = new Map(getMaxErrors(data, relativeFilename) ?? []);

    for (const [ruleID, errorCount] of ruleToErrorCount) {
        const maxErrorCount = maxErrors.get(ruleID) ?? 0;
        if (errorCount !== maxErrorCount && (errorCount < maxErrorCount || ruleSetHas(options.allowIncreaseRules, ruleID))) {
            verboseLog(options, () => `${filename}: rule ${ruleID}: ${options.frozen ? "SEATBELT_FROZEN: didn't update" : 'update'} max errors ${maxErrorCount} -> ${errorCount}`);
            maxErrors.set(ruleID, errorCount);
            changedRules++;
        }
    }

    for (const [ruleID, maxErrorCount] of [...maxErrors]) {
        if (maxErrorCount !== 0 && ruleToErrorCount.has(ruleID)) {
            continue;
        }
        if (ruleSetHas(options.keepRules, ruleID)) {
            verboseLog(options, () => `${filename}: rule ${ruleID}: SEATBELT_KEEP: didn't update max errors ${maxErrorCount} -> 0`);
            continue;
        }
        verboseLog(options, () => `${filename}: rule ${ruleID}: ${options.frozen ? "SEATBELT_FROZEN: didn't update" : 'update'} max errors ${maxErrorCount} -> 0`);
        maxErrors.delete(ruleID);
        removedRules.add(ruleID);
    }

    const changed = (changedRules > 0 || removedRules.size > 0) && !options.frozen;
    if (changed) {
        const fileState = data.get(relativeFilename);
        if (fileState) {
            fileState.maxErrors = maxErrors;
        } else {
            data.set(relativeFilename, {maxErrors, lines: []});
        }
    }
    return {removedRules, changed};
}

function frozenRemovedRuleMessages(filename, seatbeltFile, removedRules, maxErrorsBefore) {
    return [...removedRules].map((ruleID) => ({
        filePath: filename,
        ruleID,
        line: 1,
        column: 0,
        severity: LINT_SEVERITY.ERROR,
        message: frozenText(seatbeltFile, 0, maxErrorsBefore.get(ruleID)),
    }));
}

function writeTSVAtomically(seatbeltFile, tsv) {
    const tempPath = `${seatbeltFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, tsv);
    try {
        fs.renameSync(tempPath, seatbeltFile);
    } catch (error) {
        fs.rmSync(tempPath, {force: true});
        if (error?.code !== 'EXDEV') {
            throw error;
        }
        fs.writeFileSync(seatbeltFile, tsv);
    }
}

const readText = (file) => {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
};

// lintedFilenames must include files without findings, so rows for fully fixed files are removed.
function applySeatbelt(messages, options, lintedFilenames) {
    if (options.disable) {
        const existing = readText(options.seatbeltFile) ?? DEFAULT_FILE_HEADER;
        return {messages, tsv: existing.endsWith('\n') || !existing ? existing : `${existing}\n`, wrote: false, changed: false};
    }

    const existingText = readText(options.seatbeltFile);
    const {data, comments, trailingComments} = existingText ? parseSeatbeltTSV(existingText) : {data: new Map(), comments: DEFAULT_FILE_HEADER, trailingComments: ''};

    const byFile = new Map();
    for (const message of canonicalizeMessages(messages)) {
        const fileMessages = byFile.get(message.filePath) ?? [];
        fileMessages.push(message);
        byFile.set(message.filePath, fileMessages);
    }
    for (const filename of lintedFilenames) {
        if (!byFile.has(filename)) {
            byFile.set(filename, []);
        }
    }

    const transformed = [];
    let anyChanged = false;
    for (const [filename, fileMessages] of byFile) {
        const maxErrorsBefore = new Map(getMaxErrors(data, toRelativePath(options.seatbeltFile, filename)) ?? []);
        const after = transformMessages(options, data, filename, fileMessages);
        const {removedRules, changed} = updateMaxErrors(options, data, filename, countRuleIDs(fileMessages));
        anyChanged ||= changed;
        transformed.push(...after);
        if (options.frozen) {
            transformed.push(...frozenRemovedRuleMessages(filename, options.seatbeltFile, removedRules, maxErrorsBefore));
        }
    }

    // Rows for files that no longer exist are dropped.
    let pruned = 0;
    for (const relativeFilename of [...data.keys()]) {
        if (fs.existsSync(toAbsolutePath(options.seatbeltFile, relativeFilename))) {
            continue;
        }
        if (options.frozen) {
            verboseLog(options, () => `${relativeFilename}: SEATBELT_FROZEN: didn't remove max errors`);
            continue;
        }
        verboseLog(options, () => `${relativeFilename}: remove max errors`);
        data.delete(relativeFilename);
        anyChanged = true;
        pruned++;
    }

    const tsv = serializeSeatbeltTSV(data, comments || DEFAULT_FILE_HEADER, trailingComments);
    const shouldWrite = anyChanged && !options.frozen && !options.readOnly;
    if (pruned > 0) {
        console.error(`${SEATBELT_NAME}: ${shouldWrite ? 'removed' : 'would remove'} ${pruned} baseline row(s) for deleted files`);
    }
    if (shouldWrite) {
        writeTSVAtomically(options.seatbeltFile, tsv);
    }
    return {messages: canonicalizeMessages(transformed), tsv, wrote: shouldWrite, changed: anyChanged};
}

function readBooleanEnvVar(value) {
    if (value === undefined || value === '') {
        return undefined;
    }
    return !['0', 'false', 'no'].includes(value.toLowerCase());
}

function parseRuleSetEnvVar(value) {
    if (value === undefined) {
        return undefined;
    }
    if (!value) {
        return new Set();
    }
    return ['all', '1', 'true'].includes(value.toLowerCase()) ? 'all' : new Set(value.split(/[\s,]+/g).filter(Boolean));
}

function resolveSeatbeltOptions(projectRoot, env = process.env) {
    const allowIncreaseRules = parseRuleSetEnvVar(env.SEATBELT_INCREASE) ?? new Set();
    const isIncreaseSet = allowIncreaseRules === 'all' || allowIncreaseRules.size > 0;
    return {
        seatbeltFile: path.join(projectRoot, SEATBELT_TSV_RELATIVE),
        projectRoot,
        disable: readBooleanEnvVar(env.SEATBELT_DISABLE) ?? false,
        frozen: readBooleanEnvVar(env.SEATBELT_FROZEN) ?? false,
        readOnly: isIncreaseSet ? false : readBooleanEnvVar(env.SEATBELT_READ_ONLY) ?? !readBooleanEnvVar(env.CI),
        allowIncreaseRules,
        keepRules: parseRuleSetEnvVar(env.SEATBELT_KEEP) ?? new Set(),
        quiet: readBooleanEnvVar(env.SEATBELT_QUIET) ?? false,
        verbose: readBooleanEnvVar(env.SEATBELT_VERBOSE) ?? false,
    };
}

export {
    LINT_SEVERITY,
    SEATBELT_TSV_RELATIVE,
    applySeatbelt,
    canonicalizeMessages,
    countRuleIDs,
    parseSeatbeltTSV,
    resolveSeatbeltOptions,
    serializeSeatbeltTSV,
    transformMessages,
    updateMaxErrors,
};
