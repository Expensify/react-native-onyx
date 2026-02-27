/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validatePRChecklist.ts -o index.js
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

function getSectionContent(body: string, sectionName: string): string {
    const match = body.match(new RegExp(`### ${sectionName}\\s*\\n([\\s\\S]*?)(?=###|$)`));
    return (match?.[1] || '').replace(/<!-[\s\S]*?->/g, '').trim();
}

async function run() {
    try {
        const body = github.context.payload.pull_request?.body || '';
        const errors: string[] = [];

        // Check that all checklist items are checked
        const uncheckedPattern = /- \[ \]/g;
        const checkedPattern = /- \[x\]/gi;
        const uncheckedMatches = body.match(uncheckedPattern) || [];
        const checkedMatches = body.match(checkedPattern) || [];
        const totalCheckboxes = uncheckedMatches.length + checkedMatches.length;

        if (totalCheckboxes === 0) {
            errors.push('No checklist items found in the PR description. Please use the PR template and complete the Author Checklist.');
        } else if (uncheckedMatches.length > 0) {
            errors.push(
                `${uncheckedMatches.length} checklist item(s) are unchecked. All checklist items must be checked before merging — including items that don't apply (check them and note why if needed).`,
            );
        }

        // Warn if "Automated Tests" section is empty
        const automatedTestsContent = getSectionContent(body, 'Automated Tests');
        if (automatedTestsContent.length === 0) {
            core.warning(
                'The "Automated Tests" section is empty. Please describe the automated tests you added, or explain why automated tests are not needed for this change.',
            );
        }

        // Warn if "Manual Tests" section is empty
        const manualTestsContent = getSectionContent(body, 'Manual Tests');
        if (manualTestsContent.length === 0) {
            core.warning('The "Manual Tests" section is empty. Please describe how you manually tested this change.');
        }

        // Warn if GH_LINK placeholder is still present
        const relatedIssuesContent = getSectionContent(body, 'Related Issues');
        if (relatedIssuesContent === 'GH_LINK' || relatedIssuesContent.length === 0) {
            core.warning(
                'The "Related Issues" section still contains the GH_LINK placeholder or is empty. Please replace it with the actual GitHub issue link.',
            );
        }

        // Fail if there are errors
        if (errors.length > 0) {
            const summary = `## PR Checklist Validation Failed\n\n${errors.map((error) => `- ${error}`).join('\n')}\n\nPlease complete the checklist and update the PR description.`;

            core.summary.addRaw(summary);
            await core.summary.write();
            core.setFailed(errors.join('\n'));
        }
    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

void run();
