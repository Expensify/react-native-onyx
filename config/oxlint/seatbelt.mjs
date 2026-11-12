// config/oxlint/oxlint.seatbelt.tsv records, per file and rule, how many errors are allowed. Errors up to that count
// report as warnings; one more fails the run. Counts can only go down, unless SEATBELT_INCREASE names the rule.
//
// Local runs only read the file, so fixing errors leaves the working tree clean. CI writes it, and the lint job on
// main commits the tightened file back as os-botify (.github/workflows/lint.yml).
//
// Env:
//   SEATBELT_INCREASE=<rules|all>  allow and record an increase (commit the file with your change)
//   SEATBELT_READ_ONLY=0           write the file locally
//   SEATBELT_FROZEN=1              fail on any difference from the file
//   SEATBELT_KEEP=<rules|all>      keep rows that reached zero
//   SEATBELT_DISABLE=1             turn the seatbelt off
//   SEATBELT_QUIET=1               hide the grandfathered warnings
//   SEATBELT_VERBOSE=1             log every decision
import fs from 'node:fs';
import path from 'node:path';

const SEATBELT_NAME = 'seatbelt';
const SEATBELT_TSV_RELATIVE = 'config/oxlint/oxlint.seatbelt.tsv';
const DEFAULT_FILE_HEADER = `# ${SEATBELT_NAME} temporarily allowed errors
# docs: config/oxlint/seatbelt.mjs`;

const LINT_SEVERITY = {WARNING: 1, ERROR: 2};

const toRelativePath = (baseFile, filename) => (path.isAbsolute(filename) ? path.relative(path.dirname(baseFile), filename) : filename);
const toAbsolutePath = (baseFile, filename) => (path.isAbsolute(filename) ? filename : path.resolve(path.dirname(baseFile), filename));

/**
 * Each data line holds tab-separated JSON values. Comments before the first row are the header, comments after the
 * last row are trailing, and any other comment travels with the row below it when rows are sorted.
 * @param {string} text - Contents of the file.
 */
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

/**
 * Writes the header, then the rows sorted with their comments, then the trailing comments.
 * @param {object} parts - The header comments, trailing comments and rows to write.
 * @param {string} parts.leadingComments - Header comments.
 * @param {string} parts.trailingComments - Comments after the last row.
 * @param {object[]} parts.rows - Rows with their cells and comments.
 */
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

/**
 * Checks that a parsed row is a file name, a rule ID and a count, and returns it as a baseline line.
 * @param {unknown[]} row - Parsed cells of one line.
 * @param {number} lineNumber - Position of the row, used in error messages.
 */
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

/**
 * Reads baseline text into a Map from file name to that file's lines, plus the header and trailing comments.
 * Throws on a row that is not a file name, a rule ID and a count.
 * @param {string} text - Contents of the baseline file.
 */
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

/**
 * Turns the baseline Map back into text. A file whose counts were updated (maxErrors) is written from those counts,
 * and each row keeps its comments.
 * @param {Map<string, object>} data - Baseline per file name.
 * @param {string} comments - Header comments.
 * @param {string} [trailingComments] - Comments after the last row.
 */
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

/**
 * Returns a file's allowed error count per rule, or undefined if the baseline has no rows for it. The Map is built
 * from the file's lines on the first call and kept in fileState.maxErrors, where updateMaxErrors also stores new counts.
 * @param {Map<string, object>} data - Baseline per file name.
 * @param {string} relativeFilename - File name as written in the baseline.
 */
function getMaxErrors(data, relativeFilename) {
    const fileState = data.get(relativeFilename);
    if (!fileState) {
        return undefined;
    }
    fileState.maxErrors ??= new Map(fileState.lines.map((line) => [line.ruleID, line.maxErrors]));
    return fileState.maxErrors;
}

const isCountableError = (message) => message.severity === LINT_SEVERITY.ERROR && !!message.ruleID;

/**
 * Counts the errors per rule ID. Warnings and messages without a rule are skipped.
 * @param {object[]} messages - Findings of one file.
 */
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

/**
 * Orders messages by file, then rule (messages without a rule first), then line and column.
 * @param {object} a - First message.
 * @param {object} b - Second message.
 */
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

/**
 * Sorted by file, rule, line and column, so "the first N of M errors" are the same ones on every run.
 * @param {object[]} messages - Findings to sort. They are copied, not changed.
 */
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

/**
 * Applies a file's baseline to its messages: errors up to the allowed count for a rule become warnings, and the rest
 * stay errors unless SEATBELT_INCREASE names the rule. With SEATBELT_FROZEN, a count below the baseline is an error
 * too. With SEATBELT_QUIET, the warnings are dropped.
 * @param {object} options - Seatbelt options.
 * @param {Map<string, object>} data - Baseline per file name.
 * @param {string} filename - Absolute path of the file.
 * @param {object[]} messages - Findings of that file.
 */
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

/**
 * Works out a file's new allowed counts from its current error counts. Counts go down when errors were fixed, go up
 * only for SEATBELT_INCREASE rules, and rules that reached zero are dropped unless SEATBELT_KEEP names them. The new
 * counts are stored in data unless SEATBELT_FROZEN is set.
 * @param {object} options - Seatbelt options.
 * @param {Map<string, object>} data - Baseline per file name.
 * @param {string} filename - Absolute path of the file.
 * @param {Map<string, number>} ruleToErrorCount - Current error count per rule in that file.
 * @returns - The rules that were dropped, and whether the stored counts changed.
 */
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

/**
 * Creates one error per rule that still has a baseline row but no longer has any errors, which frozen mode cannot update.
 * @param {string} filename - Absolute path of the file.
 * @param {string} seatbeltFile - Absolute path of the baseline file.
 * @param {Set<string>} removedRules - Rules whose errors are all fixed.
 * @param {Map<string, number>} maxErrorsBefore - Allowed counts per rule before the run.
 */
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

/**
 * Writes through a temp file and a rename, so an interrupted run cannot leave a half-written baseline. Writes directly if the rename crosses devices (EXDEV).
 * @param {string} seatbeltFile - Absolute path of the baseline file.
 * @param {string} tsv - Text to write.
 */
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

/**
 * Applies the baseline to the messages, then writes the updated baseline unless the run is read-only or frozen.
 * lintedFilenames must include files without findings, so rows for fully fixed files are removed.
 * @param {object[]} messages - Findings from Oxlint.
 * @param {object} options - Seatbelt options.
 * @param {string[]} lintedFilenames - Absolute paths of every linted file.
 */
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

/**
 * Reads an env var holding rule IDs split by commas or spaces. `all`, `1` and `true` mean every rule, and an unset variable gives undefined.
 * @param {string | undefined} value - Value of the env var.
 */
function parseRuleSetEnvVar(value) {
    if (value === undefined) {
        return undefined;
    }
    if (!value) {
        return new Set();
    }
    return ['all', '1', 'true'].includes(value.toLowerCase()) ? 'all' : new Set(value.split(/[\s,]+/g).filter(Boolean));
}

/**
 * Builds the options from the SEATBELT_* env vars. The file is read-only unless CI is set, SEATBELT_READ_ONLY says
 * otherwise, or SEATBELT_INCREASE is set.
 * @param {string} projectRoot - Absolute path of the repo root.
 * @param {Record<string, string | undefined>} [env] - Environment variables to read.
 */
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
