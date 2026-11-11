/*
 *  Run `npm run gh-actions-build` after changes to compile and bundle this action.
 */

import * as core from '@actions/core';
import {execSync} from 'child_process';

async function run() {
    try {
        console.log('Running Reassure stability check...');
        execSync('npx reassure check-stability --verbose', {stdio: 'inherit'});

        console.log('Validating Reassure stability results...');
        execSync('node .github/actions/javascript/validateReassureOutput', {stdio: 'inherit'});

        return true;
    } catch (error) {
        console.log('error: ', error);
        core.setFailed(error instanceof Error ? error : String(error));
        process.exit(1);
    }
}

run();

export default run;
