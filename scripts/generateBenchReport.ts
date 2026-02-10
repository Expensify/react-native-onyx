#!/usr/bin/env npx tsx
/**
 * generateBenchReport.ts
 *
 * Reads one or more Vitest benchmark JSON files and produces a color-coded
 * HTML comparison table. The first file is always treated as the baseline.
 *
 * Usage:
 *   npx tsx scripts/generateBenchReport.ts <baseline.json> [variant.json ...] [-o output.html] [--open]
 *
 * Options:
 *   -o, --output <path>   Write HTML to this file (default: bench-results.html)
 *   --open                Open the report in the default browser after generating
 *   --labels <a,b,...>    Comma-separated column labels (default: filenames)
 *
 * Examples:
 *   # Single run (just shows absolute numbers, no coloring):
 *   npx tsx scripts/generateBenchReport.ts .bench-current.json
 *
 *   # Compare baseline vs current:
 *   npx tsx scripts/generateBenchReport.ts .bench-baseline.json .bench-current.json
 *
 *   # Three-way comparison with custom labels:
 *   npx tsx scripts/generateBenchReport.ts base.json idb.json sqlite.json \
 *     --labels "Baseline (IDB),DM+IDB,DM+SQLite"
 */

import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const jsonFiles: string[] = [];
let outputPath = 'bench-results.html';
let shouldOpen = false;
let labelOverrides: string[] | null = null;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
        outputPath = args[++i];
    } else if (arg === '--open') {
        shouldOpen = true;
    } else if (arg === '--labels') {
        labelOverrides = args[++i].split(',').map((s) => s.trim());
    } else if (!arg.startsWith('-')) {
        jsonFiles.push(arg);
    }
}

if (jsonFiles.length === 0) {
    console.error('Usage: generateBenchReport.ts <baseline.json> [variant.json ...] [-o output.html] [--open]');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BenchmarkEntry = {
    name: string;
    mean: number;
    rme: number;
    sampleCount: number;
    min: number;
    max: number;
    p75: number;
};

type ParsedResults = Map<string, BenchmarkEntry>; // key → entry

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

function parseBenchmarkJSON(filePath: string): ParsedResults {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const results: ParsedResults = new Map();

    for (const file of raw.files ?? []) {
        for (const group of file.groups ?? []) {
            const groupName: string = group.fullName ?? '';
            for (const b of group.benchmarks ?? []) {
                const key = `${groupName} | ${b.name}`;
                results.set(key, {
                    name: b.name,
                    mean: b.mean,
                    rme: b.rme,
                    sampleCount: b.sampleCount,
                    min: b.min,
                    max: b.max,
                    p75: b.p75,
                });
            }
        }
    }

    return results;
}

// ---------------------------------------------------------------------------
// Data assembly
// ---------------------------------------------------------------------------

const allResults: ParsedResults[] = jsonFiles.map(parseBenchmarkJSON);
const baseline = allResults[0];
const variants = allResults.slice(1);

// Collect all keys, preserving order from the first file that has each key
const allKeys: string[] = [];
const seenKeys = new Set<string>();
for (const results of allResults) {
    for (const key of results.keys()) {
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allKeys.push(key);
        }
    }
}

// Sort keys by operation group then tier (size)
const TIERS = ['small', 'modest', 'heavy', 'extreme'];

// Operation groups: each entry is [matchString, groupLabel]
const OP_GROUPS: [string, string][] = [
    ['set() -', 'Onyx.set()'],
    ['multiSet()', 'Onyx.multiSet()'],
    ['setCollection()', 'Onyx.setCollection()'],
    ['merge() -', 'Onyx.merge()'],
    ['mergeCollection()', 'Onyx.mergeCollection()'],
    ['update()', 'Onyx.update()'],
    ['connect() - register', 'Onyx.connect() - register subscribers'],
    ['collection subscriber', 'Onyx.connect() - collection subscriber'],
    ['Notification', 'Notification throughput'],
    ['init()', 'Onyx.init()'],
    ['clear()', 'Onyx.clear()'],
];

function getTierIndex(key: string): number {
    const idx = TIERS.findIndex((t) => key.toLowerCase().includes(t));
    return idx >= 0 ? idx : 99;
}

function getOpIndex(key: string): number {
    const idx = OP_GROUPS.findIndex(([match]) => key.includes(match));
    return idx >= 0 ? idx : 99;
}

function getOpGroupLabel(key: string): string {
    const entry = OP_GROUPS.find(([match]) => key.includes(match));
    return entry ? entry[1] : '';
}

allKeys.sort((a, b) => {
    const oa = getOpIndex(a);
    const ob = getOpIndex(b);
    if (oa !== ob) return oa - ob;
    return getTierIndex(a) - getTierIndex(b);
});

// ---------------------------------------------------------------------------
// Column labels
// ---------------------------------------------------------------------------

const labels: string[] =
    labelOverrides ??
    jsonFiles.map((f) => {
        const base = path.basename(f, '.json');
        return base.replace(/^\.?bench-?/, '') || 'baseline';
    });

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
    if (ms < 0.01) return ms.toFixed(4);
    if (ms < 1) return ms.toFixed(3);
    if (ms < 10) return ms.toFixed(2);
    if (ms < 100) return ms.toFixed(1);
    return ms.toFixed(0);
}

type CellClass = 'green' | 'red' | 'neutral' | 'baseline';

function classifyChange(baseMean: number, variantMean: number): CellClass {
    const pct = ((variantMean - baseMean) / baseMean) * 100;
    const absDiff = Math.abs(variantMean - baseMean);
    const absPct = Math.abs(pct);

    // Negligible: < 5% change OR < 1ms absolute difference
    if (absPct < 5 || absDiff < 1) {
        return 'neutral';
    }
    return pct < 0 ? 'green' : 'red';
}

function renderCell(entry: BenchmarkEntry | undefined, baseEntry: BenchmarkEntry | undefined, isBaseline: boolean): string {
    if (!entry) return '<td class="neutral">&ndash;</td>';

    const ms = fmtMs(entry.mean);

    if (isBaseline || !baseEntry) {
        return `<td class="baseline">${ms}</td>`;
    }

    const pct = ((entry.mean - baseEntry.mean) / baseEntry.mean) * 100;
    const sign = pct > 0 ? '+' : '';
    const pctStr = `${sign}${pct.toFixed(0)}%`;
    const cls = classifyChange(baseEntry.mean, entry.mean);

    // For unreliable results (very high RME with very few samples), add a warning
    const isUnreliable = entry.rme > 100 && entry.sampleCount <= 10;
    const warning = isUnreliable ? ' <span title="High variance">&#9888;</span>' : '';

    return `<td class="${cls}">${ms} (${pctStr})${warning}</td>`;
}

function getTierLabel(key: string): string {
    for (const t of TIERS) {
        if (key.toLowerCase().includes(t)) {
            return t.charAt(0).toUpperCase() + t.slice(1);
        }
    }
    return '';
}

function getTierDescription(key: string): string {
    // Extract the scale description like "50 reports, 50 txns" from
    // "benchmarks/set.bench.ts > set (small (50 reports, 50 txns))"
    const match = key.match(/\((?:small|modest|heavy|extreme)\s*\(([^)]+)\)/i);
    return match ? match[1] : '';
}

function getOperationName(key: string): string {
    const parts = key.split(' | ');
    return parts[parts.length - 1];
}

// Build rows grouped by operation, ordered by tier within each group
let tableRows = '';
let lastOpGroup = '';

for (const key of allKeys) {
    const opGroup = getOpGroupLabel(key);

    if (opGroup !== lastOpGroup) {
        lastOpGroup = opGroup;
        const colspan = 1 + allResults.length;
        tableRows += `<tr class="tier-header"><td colspan="${colspan}">${escapeHtml(opGroup)}</td></tr>\n`;
    }

    const tier = getTierLabel(key);
    const desc = getTierDescription(key);
    const opName = getOperationName(key);
    // Show tier + size context alongside the operation name
    const rowLabel = tier ? `${tier} (${desc})` : opName;

    const baseEntry = baseline.get(key);

    let cells = renderCell(baseEntry, undefined, true);
    for (const variant of variants) {
        cells += renderCell(variant.get(key), baseEntry, false);
    }

    tableRows += `<tr><td>${escapeHtml(rowLabel)}</td>${cells}</tr>\n`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Column headers
let headerCells = labels.map((label) => `<th>${escapeHtml(label)}</th>`).join('');

const timestamp = new Date().toLocaleString();

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Onyx Benchmark Results</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1400px; margin: 20px auto; padding: 0 20px; background: #1a1a2e; color: #e0e0e0; }
h1 { color: #fff; }
.meta { font-size: 12px; color: #888; margin-bottom: 1em; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 13px; }
th, td { padding: 6px 10px; border: 1px solid #333; text-align: right; white-space: nowrap; }
th { background: #16213e; color: #fff; text-align: center; }
td:first-child { text-align: left; font-family: monospace; font-size: 12px; }
.green { background: #1b4332; color: #95d5b2; font-weight: 600; }
.red { background: #3d0000; color: #ff8a8a; font-weight: 600; }
.neutral { color: #999; }
.baseline { color: #bbb; }
.tier-header td { background: #16213e; color: #fff; font-weight: bold; font-size: 14px; text-align: left !important; }
.legend { margin: 1em 0; font-size: 13px; }
.legend span { padding: 2px 8px; border-radius: 3px; margin-right: 12px; }
</style>
</head>
<body>
<h1>Onyx Benchmark Results</h1>
<p class="meta">Generated ${escapeHtml(timestamp)}</p>
<div class="legend">
All values are <strong>mean time in milliseconds</strong> (lower is better).
<span class="green">Green</span> = faster (improvement, &ge;5% and &ge;1ms)
<span class="red">Red</span> = slower (regression, &ge;5% and &ge;1ms)
<span class="neutral">Gray</span> = negligible
&#9888; = unreliable (high variance, few samples)
</div>

<table>
<thead>
<tr>
<th style="text-align:left; min-width:300px">Operation</th>
${headerCells}
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Report written to ${outputPath}`);

if (shouldOpen) {
    try {
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        execSync(`${cmd} "${outputPath}"`);
    } catch {
        console.log('(Could not auto-open the report)');
    }
}
