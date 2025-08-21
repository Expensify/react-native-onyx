# Onyx sourceValue issues

These tests demonstrate and prove multiple issues with Onyx sourceValue handling:
1. **Race Condition**: Multiple discrete updates batched → only first `sourceValue` visible
2. **Logic Bug**: `useSidebarOrderedReports` conditional logic ignores available `sourceValues`
3. **Stale sourceValues**: `sourceValue` preserves the keys of the latest onyx update during unrelated rerenders

See the thread in [#quality](https://expensify.slack.com/archives/C05LX9D6E07/p1755792968968239?thread_ts=1755543034.080259&cid=C05LX9D6E07) for more info

## Test Files

**`simpleSourceValueRaceConditionDemo.ts`** - Pure race condition test proving batching loses intermediate `sourceValues`
**`useSidebarOrderedReportsVulnerability.ts`** - Logic bug and compound issue tests replicating production patterns
**`staleSourceValueTest`** - Test demonstrating that sourceValue persists during unrelated renders, leading to unnecessary cache busing

## How to Run the Tests

```bash
# Run the race condition test
npm test -- tests/unit/simpleSourceValueRaceConditionDemo.ts

# Run the useSidebarOrderedReports display bug tests
npm test -- tests/unit/useSidebarOrderedReportsDisplayBug.ts

# Run the staleSourceValueTest tests
npm test -- tests/unit/staleSourceValueTest.ts

# Or run all 3 at once
npm test -- tests/unit/simpleSourceValueRaceConditionDemo.ts tests/unit/useSidebarOrderedReportsDisplayBug.ts tests/unit/staleSourceValueTest.ts
```

# The race condition test and what it proves

### The Race Condition Mechanism

1. **Multiple Discrete Updates**: The test performs 3 separate Onyx operations:
   - `Onyx.merge(collection_item1)` - Add first collection item
   - `Onyx.merge(collection_item2)` - Add second collection item  
   - `Onyx.merge(collection_item3)` - Add third collection item

2. **React Batching**: Due to `unstable_batchedUpdates` and setTimeout-based batching in Onyx, all updates get batched into a single render

   **How this works internally:**
   - When Onyx updates occur, they're queued in `batchUpdatesQueue` (in `OnyxUtils.ts`)
   - `maybeFlushBatchUpdates()` uses `setTimeout(0)` to defer processing to the next event loop tick
   - Inside that timeout, `unstable_batchedUpdates(() => { updatesCopy.forEach(applyUpdates) })` wraps all queued updates
   - This forces React to treat all updates as a single batch, triggering only one render
   - The `sourceValue` gets set by the first update, then overwritten by subsequent updates, but only the final state is visible to the component

3. **Lost sourceValue Information**: Only the first `sourceValue` is visible to the component, losing information about subsequent updates

### Expected vs Actual Behavior

**Expected** (without race condition):
```
Update 1: sourceValue = {test_items_item1: {step: 1, status: 'started'}}
Update 2: sourceValue = {test_items_item2: {step: 2, status: 'processing'}} 
Update 3: sourceValue = {test_items_item3: {step: 3, status: 'completed'}}
```

**Actual** (with race condition):
```
Single Render: sourceValue = {test_items_item1: {step: 1, status: 'started'}}
// Lost: step 2 and step 3 information!
```

## Test Output Example

When you run the simple demo test, you'll see output like:

```
=== Starting the race condition test ===
About to perform 3 discrete updates that should be batched...

=== RESULTS ===
Expected: 3 discrete updates → 3 different sourceValues
Actual: 1 sourceValue(s) received
Renders: 1 (due to React batching)

SourceValues received: [
  {
    renderCount: 3,
    sourceValue: { test_items_item1: { step: 1, status: 'started', message: 'First update' } },
    timestamp: 1703123456789
  }
]
Final data: {
  test_items_item1: { step: 1, status: 'started', message: 'First update' },
  test_items_item2: { step: 2, status: 'processing', message: 'Second update' },
  test_items_item3: { step: 3, status: 'completed', message: 'Third update' }
}
Final sourceValue: { test_items_item1: { step: 1, status: 'started', message: 'First update' } }

🚨 RACE CONDITION CONFIRMED:
• Expected to see 3 sourceValues
• Actually received 1 sourceValue(s)
• Lost 2 intermediate updates
• Only the FIRST update is visible in sourceValue due to batching!

This means components cannot reliably track state transitions when updates are batched!
```

## Technical Deep Dive: The Batching Mechanism

### Where `unstable_batchedUpdates` is Called

The race condition is caused by Onyx's internal batching mechanism in `lib/OnyxUtils.ts`:

```typescript
// In OnyxUtils.ts, lines ~203-226
function maybeFlushBatchUpdates(): Promise<void> {
    if (batchUpdatesPromise) {
        return batchUpdatesPromise;
    }
    batchUpdatesPromise = new Promise((resolve) => {
        setTimeout(() => {  // ⚠️ Key: Delays execution to next tick
            const updatesCopy = batchUpdatesQueue;
            batchUpdatesQueue = [];
            batchUpdatesPromise = null;
            
            unstable_batchedUpdates(() => {  // ⚠️ React batching starts here
                updatesCopy.forEach((applyUpdates) => {
                    applyUpdates(); // All updates execute together
                });
            });
            resolve();
        }, 0); // Next tick of event loop
    });
    return batchUpdatesPromise;
}
```

### Why This Causes the Race Condition

1. **Multiple Updates Queued**: Each `Onyx.merge()` call adds an update to `batchUpdatesQueue`
2. **setTimeout Delay**: All updates wait for the next event loop tick
3. **Batch Execution**: `unstable_batchedUpdates` executes all updates synchronously within React's batching context
4. **Single Render**: React sees all state changes as one update, triggering only one render
5. **Lost sourceValues**: Only the first `sourceValue` assignment survives the batching process

This is why the test demonstrates that 3 discrete updates result in only 1 `sourceValue` being visible to components.
