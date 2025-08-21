# SourceValue Race Condition Test Documentation

## Overview

This test demonstrates and proves the race condition where multiple discrete Onyx updates get batched into a single React render, causing the `sourceValue` to only represent the first update rather than all the discrete updates that occurred.

## Test File

**`simpleSourceValueRaceConditionDemo.ts`** - Focused demonstration that clearly proves the race condition

## How to Run the Test

```bash
# Run the test file
npm test -- tests/unit/simpleSourceValueRaceConditionDemo.ts

# Or run with more verbose output to see the detailed logging
npm test -- tests/unit/simpleSourceValueRaceConditionDemo.ts --verbose
```

## What the Test Proves

### The Race Condition Mechanism

1. **Multiple Discrete Updates**: The test performs 3 separate Onyx operations:
   - `Onyx.merge(collection_item1)` - Add first collection item
   - `Onyx.merge(collection_item2)` - Add second collection item  
   - `Onyx.merge(collection_item3)` - Add third collection item

2. **React Batching**: Due to `unstable_batchedUpdates` and setTimeout-based batching in Onyx, all updates get batched into a single render

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
