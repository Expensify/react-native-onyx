#!/usr/bin/env npx tsx
/**
 * stabilizeBenchmarks.ts
 *
 * Runs benchmarks, detects noisy/unreliable results, re-runs the affected
 * benchmark files, and merges the improved results — repeating until the
 * results are stable or a retry limit is reached.
 *
 * Usage:
 *   npx tsx scripts/stabilizeBenchmarks.ts -o results.json [-- vitest args...]
 *
 * Options:
 *   -o, --output <path>       Output JSON path (required)
 *   --max-retries <n>         Max stabilization passes (default: 3)
 *   --rme-threshold <n>       RME % above which a result is "noisy" (default: 50)
 *   --outlier-ratio <n>       max/p75 ratio above which a result is "noisy" (default: 10)
 *   --min-samples <n>         Results with fewer samples are candidates for re-run (default: 10)
 *   --quiet                   Suppress per-benchmark diagnostics
 *   -- <args>                 Extra args forwarded to vitest bench
 *
 * Exit codes:
 *   0  All results stable (or stabilized within retries)
 *   1  Some results remain noisy after all retries (results still written)
 *   2  Fatal error
 */

import * as fs from 'fs';
import {execSync} from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RawBenchmark = {
    id: string;
    name: string;
    mean: number;
    rme: number;
    sampleCount: number;
    min: number;
    max: number;
    p75: number;
    [k: string]: unknown;
};

type RawGroup = {
    fullName: string;
    benchmarks: RawBenchmark[];
};

type RawFile = {
    filepath: string;
    groups: RawGroup[];
};

type RawJSON = {
    files: RawFile[];
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
let outputPath = '';
let maxRetries = 3;
let rmeThreshold = 50;
let outlierRatio = 10;
let minSamples = 10;
let quiet = false;
const vitestArgs: string[] = [];

let seenDoubleDash = false;
for (let i = 0; i < argv.length; i++) {
    if (seenDoubleDash) {
        vitestArgs.push(argv[i]);
        continue;
    }
    switch (argv[i]) {
        case '-o':
        case '--output':
            outputPath = argv[++i];
            break;
        case '--max-retries':
            maxRetries = parseInt(argv[++i], 10);
            break;
        case '--rme-threshold':
            rmeThreshold = parseFloat(argv[++i]);
            break;
        case '--outlier-ratio':
            outlierRatio = parseFloat(argv[++i]);
            break;
        case '--min-samples':
            minSamples = parseInt(argv[++i], 10);
            break;
        case '--quiet':
            quiet = true;
            break;
        case '--':
            seenDoubleDash = true;
            break;
        default:
            console.error(`Unknown option: ${argv[i]}`);
            process.exit(2);
    }
}

if (!outputPath) {
    console.error('Usage: stabilizeBenchmarks.ts -o <output.json> [--max-retries N] [-- vitest args...]');
    process.exit(2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runVitest(jsonOut: string, extraFiles: string[] = []): void {
    const fileArgs = extraFiles.length > 0 ? extraFiles.join(' ') : '';
    const extra = vitestArgs.length > 0 ? vitestArgs.join(' ') : '';
    const cmd = `npx vitest bench --config vitest.bench.config.ts --outputJson "${jsonOut}" ${fileArgs} ${extra}`.trim();

    if (!quiet) {
        console.log(`  $ ${cmd}`);
    }

    execSync(cmd, {stdio: 'inherit', timeout: 600_000});
}

function readJSON(filePath: string): RawJSON {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as RawJSON;
}

function writeJSON(filePath: string, data: RawJSON): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Determine if a benchmark result is "noisy" and would benefit from a re-run.
 *
 * The criteria are designed to avoid false positives:
 *
 *  - Sub-millisecond operations (clear, connect register) naturally have high
 *    outlier ratios from GC spikes, but the mean is stable across runs. We
 *    only flag these if the outlier actually shifts the mean significantly.
 *
 *  - Slow operations (multiSet 5000, init 5000) inherently get few samples
 *    within vitest's time budget. Low sample count alone is NOT a trigger;
 *    it only matters when paired with high RME (indicating the few samples
 *    are also inconsistent).
 *
 * A result is noisy if ANY of these compound conditions is met:
 *  1. High RME on a meaningfully-sized operation (mean > 1ms)
 *  2. Few samples AND high RME (the samples we got are inconsistent)
 *  3. Extreme outlier that materially affects the mean (max-p75 > 10ms
 *     AND the outlier's contribution shifts the mean by >20%)
 */
function isNoisy(b: RawBenchmark): {noisy: boolean; reasons: string[]} {
    const reasons: string[] = [];

    // 1. High RME on operations where it matters (mean > 1ms avoids flagging
    //    sub-ms benchmarks where RME is naturally high but absolute error is tiny)
    if (b.rme > rmeThreshold && b.mean > 1) {
        reasons.push(`RME ${b.rme.toFixed(1)}% > ${rmeThreshold}% (mean=${b.mean.toFixed(2)}ms)`);
    }

    // 2. Very few samples AND they're inconsistent (low samples alone is fine
    //    for inherently slow benchmarks that produce stable results)
    if (b.sampleCount <= minSamples && b.rme > rmeThreshold / 2) {
        reasons.push(`${b.sampleCount} samples with RME ${b.rme.toFixed(1)}%`);
    }

    // 3. Extreme outlier that materially skews the mean:
    //    - max is far beyond p75 (single spike)
    //    - AND the spike actually shifts the mean by a meaningful absolute amount (>2ms)
    //    - AND the spike shifts the mean by a significant percentage (>20%)
    //    This filters out GC spikes on sub-ms operations like clear() and connect()
    //    where max can be 100ms+ but the mean remains stable at ~0.1ms across runs.
    if (b.p75 > 0 && b.max / b.p75 > outlierRatio) {
        const spikeSize = b.max - b.p75;
        const spikeImpactOnMean = spikeSize / b.sampleCount;
        const spikeShiftPct = (spikeImpactOnMean / b.mean) * 100;
        if (spikeImpactOnMean > 2 && spikeShiftPct > 20) {
            reasons.push(`outlier spike: max=${b.max.toFixed(1)}ms vs p75=${b.p75.toFixed(1)}ms, ~${spikeShiftPct.toFixed(0)}% mean shift`);
        }
    }

    return {noisy: reasons.length > 0, reasons};
}

/**
 * Scan all results and return the set of benchmark file paths that contain
 * at least one noisy result.
 */
function findNoisyFiles(data: RawJSON): {files: Set<string>; details: string[]} {
    const noisyFiles = new Set<string>();
    const details: string[] = [];

    for (const file of data.files) {
        for (const group of file.groups) {
            for (const bench of group.benchmarks) {
                const {noisy, reasons} = isNoisy(bench);
                if (noisy) {
                    noisyFiles.add(file.filepath);
                    details.push(`  ${bench.name} (${group.fullName}): ${reasons.join('; ')}`);
                }
            }
        }
    }

    return {files: noisyFiles, details};
}

/**
 * Merge re-run results into the original data. For each file present in the
 * rerun data, replace ALL results from that file (not just noisy ones) since
 * benchmarks within a file share setup/teardown context.
 */
function mergeResults(original: RawJSON, rerun: RawJSON): RawJSON {
    const rerunFileSet = new Set(rerun.files.map((f) => f.filepath));

    // Keep original files that weren't re-run, replace those that were
    const mergedFiles: RawFile[] = [];
    for (const file of original.files) {
        if (rerunFileSet.has(file.filepath)) {
            // Find the re-run version
            const rerunFile = rerun.files.find((f) => f.filepath === file.filepath);
            if (rerunFile) {
                mergedFiles.push(rerunFile);
            }
        } else {
            mergedFiles.push(file);
        }
    }

    return {files: mergedFiles};
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
    // 1. Initial full run
    console.log('=== Initial benchmark run ===');
    const initialJson = `${outputPath}.tmp-initial.json`;
    runVitest(initialJson);
    let data = readJSON(initialJson);

    // 2. Stabilization loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const {files: noisyFiles, details} = findNoisyFiles(data);

        if (noisyFiles.size === 0) {
            console.log(`\n=== All results stable after ${attempt === 1 ? 'initial run' : `${attempt - 1} re-run(s)`} ===`);
            writeJSON(outputPath, data);
            cleanup();
            process.exit(0);
        }

        console.log(`\n=== Stabilization pass ${attempt}/${maxRetries} ===`);
        console.log(`Found ${details.length} noisy result(s) across ${noisyFiles.size} file(s):`);
        if (!quiet) {
            for (const d of details) {
                console.log(d);
            }
        }
        console.log(`\nRe-running: ${[...noisyFiles].join(', ')}`);

        const rerunJson = `${outputPath}.tmp-rerun-${attempt}.json`;
        runVitest(rerunJson, [...noisyFiles]);

        const rerunData = readJSON(rerunJson);
        data = mergeResults(data, rerunData);
    }

    // 3. Final check
    const {files: remainingNoisy, details: remainingDetails} = findNoisyFiles(data);
    if (remainingNoisy.size > 0) {
        console.log(`\n=== Warning: ${remainingDetails.length} result(s) still noisy after ${maxRetries} retries ===`);
        if (!quiet) {
            for (const d of remainingDetails) {
                console.log(d);
            }
        }
    } else {
        console.log(`\n=== All results stabilized after ${maxRetries} re-run(s) ===`);
    }

    writeJSON(outputPath, data);
    cleanup();
    process.exit(remainingNoisy.size > 0 ? 1 : 0);
}

function cleanup() {
    // Remove temp files
    const dir = outputPath.substring(0, outputPath.lastIndexOf('/') + 1) || '.';
    const base = outputPath.substring(outputPath.lastIndexOf('/') + 1);
    try {
        const files = fs.readdirSync(dir || '.');
        for (const f of files) {
            if (f.startsWith(`${base}.tmp-`)) {
                fs.unlinkSync(`${dir}${f}`);
            }
        }
    } catch {
        // ignore cleanup errors
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(2);
});
