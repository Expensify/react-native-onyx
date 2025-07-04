const Sequencer = require('@jest/test-sequencer').default;

/**
 * Makes all unit tests run ordered by their path, reducing flakiness on Reassure.
 */
class TestSequencer extends Sequencer {
    shard(tests, {shardIndex, shardCount}) {
        const shardSize = Math.ceil(tests.length / shardCount);
        const shardStart = shardSize * (shardIndex - 1);
        const shardEnd = shardSize * shardIndex;

        return [...tests].sort((a, b) => (a.path > b.path ? 1 : -1)).slice(shardStart, shardEnd);
    }

    sort(tests) {
        const copyTests = [...tests];
        return copyTests.sort((testA, testB) => (testA.path > testB.path ? 1 : -1));
        // return copyTests.sort((testA, testB) => {
        //     const isAOnyx = testA.path.includes('OnyxUtils.perf-test.ts');
        //     const isBOnyx = testB.path.includes('OnyxUtils.perf-test.ts');

        //     if (isAOnyx && !isBOnyx) return -1;
        //     if (!isAOnyx && isBOnyx) return 1;

        //     return testA.path.localeCompare(testB.path);
        // });
    }
}

module.exports = TestSequencer;
