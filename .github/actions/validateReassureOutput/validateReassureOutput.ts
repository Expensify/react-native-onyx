/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validateReassureOutput.ts -o index.js
 */

import * as core from '@actions/core';
import type {CompareResult, PerformanceEntry} from '@callstack/reassure-compare/src/types';
import fs from 'fs';

async function run() {
    try {
        const regressionOutput: CompareResult = JSON.parse(fs.readFileSync('.reassure/output.json', 'utf8'));
        const durationDeviation = Number(core.getInput('DURATION_DEVIATION_PERCENTAGE', {required: true}));

        if (regressionOutput.significant === undefined || regressionOutput.significant.length === 0) {
            console.log('No significant data available. Exiting...');
            return true;
        }

        console.log(`Processing ${regressionOutput.significant.length} measurements...`);

        for (let i = 0; i < regressionOutput.significant.length; i++) {
            const measurement = regressionOutput.significant[i];
            const baseline: PerformanceEntry = measurement.baseline;
            const current: PerformanceEntry = measurement.current;

            console.log(`Processing measurement ${i + 1}: ${measurement.name}`);

            const increasePercentage = ((current.meanDuration - baseline.meanDuration) / baseline.meanDuration) * 100;
            if (increasePercentage > durationDeviation) {
                core.setFailed(`Duration increase percentage exceeded the allowed deviation of ${durationDeviation}%. Current percentage: ${increasePercentage}%`);
                break;
            } else {
                console.log(`Duration increase percentage ${increasePercentage}% is within the allowed deviation range of ${durationDeviation}%.`);
            }
        }

        return true;
    } catch (error) {
        console.log('error: ', error);
        core.setFailed(error.message);
    }
}

run();

export default run;
