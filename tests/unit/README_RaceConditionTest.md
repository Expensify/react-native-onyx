# SourceValue Race Condition Test Documentation

## Overview

This test demonstrates and proves the race condition where multiple discrete Onyx updates get batched into a single React render, causing the `sourceValue` to only represent the final update rather than all the discrete updates that occurred.

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
   - `Onyx.set()` - Initial data
   - `Onyx.merge()` - Progress update
   - `Onyx.merge()` - Final update

2. **React Batching**: Due to `unstable_batchedUpdates` and setTimeout-based batching in Onyx, all updates get batched into a single render

3. **Lost sourceValue Information**: Only the final `sourceValue` is visible to the component

### Expected vs Actual Behavior

**Expected** (without race condition):
```
Update 1: sourceValue = {step: 1, status: 'started'}
Update 2: sourceValue = {step: 2, status: 'processing'} 
Update 3: sourceValue = {step: 3, status: 'completed'}
```

**Actual** (with race condition):
```
Single Render: sourceValue = {step: 3, status: 'completed'}
// Lost: step 1 and step 2 information!
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
    renderCount: 2,
    sourceValue: { step: 3, status: 'completed', message: 'Third update' },
    timestamp: 1703123456789
  }
]
Final data: { step: 3, status: 'completed', message: 'Third update' }
Final sourceValue: { step: 3, status: 'completed', message: 'Third update' }

🚨 RACE CONDITION CONFIRMED:
• Expected to see 3 sourceValues
• Actually received 1 sourceValue(s)
• Lost 2 intermediate updates

This means components cannot reliably track state transitions when updates are batched!
```

## Real-World Impact

This race condition affects components that rely on `sourceValue` to:

1. **Track State Transitions**: Can't detect loading → processing → completed flows
2. **Trigger Side Effects**: May miss intermediate states that should trigger specific actions
3. **Show Progress Indicators**: Can't show step-by-step progress updates
4. **Implement State Machines**: State transition logic may skip states

## Common Scenarios Where This Occurs

1. **Pusher Event Sequences**: Multiple real-time updates arriving rapidly
2. **API Response Processing**: Server responses containing multiple related updates
3. **Background Sync**: Bulk data synchronization operations
4. **User Action Chains**: Rapid user interactions triggering multiple updates

## How to Verify in Your Own Code

Look for patterns like:

```typescript
const [data, {sourceValue}] = useOnyx(ONYXKEYS.SOME_KEY);

useEffect(() => {
  if (sourceValue?.step === 1) {
    // This might never fire if step 1 gets batched with step 2!
    startProgressIndicator();
  }
  if (sourceValue?.step === 2) {
    // This might never fire if step 2 gets batched with step 3!
    showProcessingState();
  }
}, [sourceValue]);
```

This pattern is vulnerable to the race condition demonstrated in these tests.
