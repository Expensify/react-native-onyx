/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t reassureStabilityCheck.ts -o index.js
 */

import * as core from '@actions/core';
import {execSync} from 'child_process';

async function run() {
    try {
        console.log('Running Reassure stability check...');
        execSync('npx reassure check-stability --verbose', {stdio: 'inherit'});

        console.log('Validating Reassure stability results...');
        execSync('node .github/actions/javascript/validateReassureOutput/index.js', {stdio: 'inherit'});

        return true;
    } catch (error) {
        console.log('error: ', error);
        core.setFailed(error.message);
        process.exit(1);
    }
}

run();

export default run;
