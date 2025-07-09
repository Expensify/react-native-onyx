/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validateReassureOutput.ts -o index.js
 */

import * as core from '@actions/core';
import type {CompareResult} from '@callstack/reassure-compare';
import fs from 'fs';

type MeasurementOutput = {
    name: string;
    description: string;
    relativeDurationDeviationPercentage: number;
    isDeviationExceeded: boolean;
};

async function run() {
    try {
        const regressionOutput: CompareResult = JSON.parse(fs.readFileSync('.reassure/output.json', 'utf8'));
        const allowedDurationDeviation = Number(core.getInput('ALLOWED_DURATION_DEVIATION', {required: true}));
        const durationDeviationPercentage = Number(core.getInput('ALLOWED_RELATIVE_DURATION_DEVIATION', {required: true}));
        const isValidatingStability = Boolean(core.getInput('IS_VALIDATING_STABILITY', {required: true}));

        if (regressionOutput.significant === undefined || regressionOutput.significant.length === 0) {
            console.log('No significant data available. Exiting...');
            return true;
        }

        const outputs: MeasurementOutput[] = [];
        console.log(`Processing ${regressionOutput.significant.length} measurements...`);

        for (let i = 0; i < regressionOutput.significant.length; i++) {
            const index = i + 1;
            const measurement = regressionOutput.significant[i];
            const durationDeviation = measurement.durationDiff;
            const relativeDurationDeviation = measurement.relativeDurationDiff;
            const relativeDurationDeviationPercentage = relativeDurationDeviation * 100;

            console.log(`Processing measurement ${index}: ${measurement.name}`);

            const isMeasurementRelevant = Math.abs(durationDeviation) > allowedDurationDeviation;
            if (!isMeasurementRelevant) {
                console.log(`Skipping measurement ${index} as it's not relevant.`);
                continue;
            }

            if (relativeDurationDeviationPercentage > durationDeviationPercentage) {
                outputs.push({
                    name: measurement.name,
                    description: `Duration deviation of ${durationDeviation.toFixed(2)} ms (${relativeDurationDeviationPercentage.toFixed(
                        2,
                    )}%) exceeded the allowed range of ${allowedDurationDeviation.toFixed(2)} ms (${durationDeviationPercentage.toFixed(2)}%).`,
                    relativeDurationDeviationPercentage,
                    isDeviationExceeded: true,
                });
            } else {
                outputs.push({
                    name: measurement.name,
                    description: `Duration deviation of ${durationDeviation.toFixed(2)} ms (${relativeDurationDeviationPercentage.toFixed(
                        2,
                    )}%) is within the allowed range of ${allowedDurationDeviation.toFixed(2)} ms (${durationDeviationPercentage.toFixed(2)}%).`,
                    relativeDurationDeviationPercentage,
                    isDeviationExceeded: false,
                });
            }
        }

        if (outputs.length === 0) {
            console.log('No relevant measurements. Exiting...');
            return true;
        }

        console.log('\nSummary:');
        outputs.sort((a, b) => b.relativeDurationDeviationPercentage - a.relativeDurationDeviationPercentage);
        outputs.forEach((output) => {
            console.log(`${output.isDeviationExceeded ? '🔴' : '🟢'} ${output.name} > ${output.description}`);
        });

        const shouldFailWorkflow = outputs.some((output) => output.isDeviationExceeded);
        if (shouldFailWorkflow) {
            if (isValidatingStability) {
                core.setFailed(
                    `🔴 Duration deviation exceeded the allowed ranges in one or more measurements during the stability checks.
                    Please rerun the workflow again.
                    `,
                );
            } else {
                core.setFailed(`🔴 Duration deviation exceeded the allowed ranges in one or more measurements.`);
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
