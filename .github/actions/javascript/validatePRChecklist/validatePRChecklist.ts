/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validatePRChecklist.ts -o index.js
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
    errors: string[];
    warnings: string[];
    stats: {expected: number; found: number; checked: number; unchecked: number};
}

const UNCHECKED_PATTERN = /- \[ \]/g;
const CHECKED_PATTERN = /- \[x\]/gi;

function getAuthorChecklistSection(body: string): string {
    const startMarker = '### Author Checklist';
    const endMarker = '### Screenshots/Videos';
    const startIndex = body.indexOf(startMarker);
    if (startIndex === -1) {
        return '';
    }
    const afterStart = startIndex + startMarker.length;
    const endIndex = body.indexOf(endMarker, afterStart);
    return endIndex === -1 ? body.substring(afterStart) : body.substring(afterStart, endIndex);
}

function getExpectedChecklistCount(): number {
    const templatePath = path.resolve(process.env.GITHUB_WORKSPACE || '.', '.github/PULL_REQUEST_TEMPLATE.md');
    const template = fs.readFileSync(templatePath, 'utf8');
    const checklistSection = getAuthorChecklistSection(template);
    return (checklistSection.match(/- \[ \]/g) || []).length;
}

function getSectionContent(body: string, sectionName: string): string {
    const match = body.match(new RegExp(`### ${sectionName}\\s*\\n([\\s\\S]*?)(?=###|$)`));
    return (match?.[1] || '').replace(/<!-[\s\S]*?->/g, '').trim();
}

function validateChecklist(body: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checklistSection = getAuthorChecklistSection(body);

    if (!checklistSection.trim()) {
        return {
            errors: ['Author Checklist section not found. Please use the PR template.'],
            warnings: [],
            stats: {expected: 0, found: 0, checked: 0, unchecked: 0},
        };
    }

    const unchecked = (checklistSection.match(UNCHECKED_PATTERN) || []).length;
    const checked = (checklistSection.match(CHECKED_PATTERN) || []).length;
    const found = unchecked + checked;
    const expected = getExpectedChecklistCount();

    if (found < expected) {
        errors.push(`Found ${found} checklist item(s) but expected at least ${expected}. It looks like items may have been removed. Please use the full PR template.`);
    }

    if (unchecked > 0) {
        errors.push(
            `${unchecked} checklist item(s) are unchecked. All items must be checked before merging — including items that don't apply (check them and note why if needed).`,
        );
    }

    // Section warnings
    if (!getSectionContent(body, 'Automated Tests')) {
        warnings.push('The "Automated Tests" section is empty. Please describe the automated tests you added, or explain why automated tests are not needed for this change.');
    }
    if (!getSectionContent(body, 'Manual Tests')) {
        warnings.push('The "Manual Tests" section is empty. Please describe how you manually tested this change.');
    }
    const issues = getSectionContent(body, 'Related Issues');
    if (issues === 'GH_LINK' || !issues) {
        warnings.push('The "Related Issues" section still contains the GH_LINK placeholder or is empty. Please replace it with the actual GitHub issue link.');
    }

    return {errors, warnings, stats: {expected, found, checked, unchecked}};
}

function buildSummary(result: ValidationResult): string {
    const parts: string[] = [];
    if (result.errors.length > 0) {
        parts.push('## PR Checklist Validation Failed\n');
        parts.push('### Errors\n');
        result.errors.forEach((e) => parts.push(`- ${e}`));
    }
    if (result.warnings.length > 0) {
        parts.push('\n### Warnings\n');
        result.warnings.forEach((w) => parts.push(`- ${w}`));
    }
    parts.push('\n### Checklist Stats\n');
    parts.push('| Metric | Value |');
    parts.push('|--------|-------|');
    parts.push(`| Expected items | ${result.stats.expected} |`);
    parts.push(`| Found items | ${result.stats.found} |`);
    parts.push(`| Checked | ${result.stats.checked} |`);
    parts.push(`| Unchecked | ${result.stats.unchecked} |`);
    return parts.join('\n');
}

async function run() {
    try {
        const body = github.context.payload.pull_request?.body || '';
        const result = validateChecklist(body);

        result.warnings.forEach((w) => core.warning(w));

        if (result.errors.length > 0 || result.warnings.length > 0) {
            core.summary.addRaw(buildSummary(result));
            await core.summary.write();
        }

        if (result.errors.length > 0) {
            core.setFailed(result.errors.join('\n'));
        }
    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

void run();
