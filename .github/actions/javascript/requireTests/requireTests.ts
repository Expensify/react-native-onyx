/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t requireTests.ts -o index.js
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            core.setFailed('GITHUB_TOKEN is not set.');
            return;
        }

        const {owner, repo} = github.context.repo;
        const pullNumber = github.context.payload.pull_request!.number;
        const octokit = github.getOctokit(token);

        // Fetch all changed files (handles pagination for large PRs)
        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
            owner,
            repo,
            pull_number: pullNumber,
            per_page: 100,
        });

        const changedFileNames: string[] = files.map((file: {filename: string}) => file.filename);

        // Identify source file changes in lib/ (excluding types, .d.ts, and mocks)
        const sourceFiles = changedFileNames.filter(
            (filename) =>
                filename.startsWith('lib/') &&
                (filename.endsWith('.ts') || filename.endsWith('.tsx')) &&
                !filename.endsWith('.d.ts') &&
                !filename.startsWith('lib/types/') &&
                !filename.includes('__mocks__'),
        );

        // Identify test file changes in tests/
        const testFiles = changedFileNames.filter(
            (filename) => filename.startsWith('tests/') && (filename.endsWith('.ts') || filename.endsWith('.tsx')),
        );

        // If source files changed but no test files changed, fail
        if (sourceFiles.length > 0 && testFiles.length === 0) {
            const fileList = sourceFiles.map((filename) => `- \`${filename}\``).join('\n');

            const summary = `## Tests Required\n\nThis PR modifies source files in \`lib/\` but does not include any test file changes in \`tests/\`.\n\n**Changed source files:**\n${fileList}\n\nPlease add or update tests to cover these changes.`;

            core.summary.addRaw(summary);
            await core.summary.write();
            core.setFailed(
                `This PR modifies ${sourceFiles.length} source file(s) in lib/ but no test files were added or modified. Please add or update tests to cover the changes.`,
            );
        } else if (sourceFiles.length > 0 && testFiles.length > 0) {
            core.info(`Source files changed: ${sourceFiles.length}, test files changed: ${testFiles.length}. Looks good!`);
        } else {
            core.info('No source files in lib/ were changed. Test requirement check passed.');
        }
    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

void run();
