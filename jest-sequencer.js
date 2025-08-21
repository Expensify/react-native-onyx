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
    }
}

module.exports = TestSequencer;
