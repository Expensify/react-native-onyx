/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validateReassureOutput.ts -o index.js
 */

import * as core from '@actions/core';
import type {CompareResult, MeasureEntry} from '@callstack/reassure-compare';
import fs from 'fs';

type MeasurementOutput = {
    name: string;
    description: string;
    increasePercentage: number;
    isGreaterThanDurationDeviationPercentage: boolean;
};

async function run() {
    try {
        const regressionOutput: CompareResult = JSON.parse(fs.readFileSync('.reassure/output.json', 'utf8'));
        const durationDeviationPercentage = Number(core.getInput('DURATION_DEVIATION_PERCENTAGE', {required: true}));

        if (regressionOutput.significant === undefined || regressionOutput.significant.length === 0) {
            console.log('No significant data available. Exiting...');
            return true;
        }

        const outputs: MeasurementOutput[] = [];
        console.log(`Processing ${regressionOutput.significant.length} measurements...`);

        for (let i = 0; i < regressionOutput.significant.length; i++) {
            const index = i + 1;
            const measurement = regressionOutput.significant[i];
            const baseline: MeasureEntry = measurement.baseline;
            const current: MeasureEntry = measurement.current;

            console.log(`Processing measurement ${index}: ${measurement.name}`);

            const isMeasurementRelevant = Math.trunc(current.meanDuration) !== Math.trunc(baseline.meanDuration);
            if (!isMeasurementRelevant) {
                console.log(`Skipping measurement ${index} as it's not relevant.`);
                continue;
            }

            const increasePercentage = ((current.meanDuration - baseline.meanDuration) / baseline.meanDuration) * 100;
            if (increasePercentage > durationDeviationPercentage) {
                outputs.push({
                    name: measurement.name,
                    description: `Duration increase percentage exceeded the allowed deviation of ${durationDeviationPercentage}%. Current percentage: ${increasePercentage}%`,
                    increasePercentage,
                    isGreaterThanDurationDeviationPercentage: true,
                });
            } else {
                outputs.push({
                    name: measurement.name,
                    description: `Duration increase percentage ${increasePercentage}% is within the allowed deviation range of ${durationDeviationPercentage}%.`,
                    increasePercentage,
                    isGreaterThanDurationDeviationPercentage: false,
                });
            }
        }

        console.log('\nSummary:');
        outputs.sort((a, b) => b.increasePercentage - a.increasePercentage);
        outputs.forEach((output) => {
            console.log(`${output.isGreaterThanDurationDeviationPercentage ? '🔴' : '🟢'} ${output.name} > ${output.description}`);
        });

        const shouldFailWorkflow = outputs.some((output) => output.isGreaterThanDurationDeviationPercentage);
        if (shouldFailWorkflow) {
            core.setFailed(`🔴 Duration increase percentage exceeded the allowed deviation in one or more measurements.`);
        }

        return true;
    } catch (error) {
        console.log('error: ', error);
        core.setFailed(error.message);
    }
}

run();

export default run;
