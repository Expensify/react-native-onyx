# React-Native-Onyx
This is a persistent storage solution wrapped in a Pub/Sub library. In general that means:

- Onyx stores and retrieves data from persistent storage
- Data is stored as key/value pairs, where the value can be anything from a single piece of data to a complex object
- Collections of data are usually not stored as a single key (e.g. an array with multiple objects), but as individual keys+ID (e.g. `report_1234`, `report_4567`, etc.). Store collections as individual keys when a component will bind directly to one of those keys. For example: reports are stored as individual keys because `SidebarLink.js` binds to the individual report keys for each link. However, report actions are stored as an array of objects because nothing binds directly to a single report action.
- Onyx allows other code to subscribe to changes in data, and then publishes change events whenever data is changed
- Anything needing to read Onyx data needs to:
    1. Know what key the data is stored in (for web, you can find this by looking in the JS console > Application > local storage)
    2. Subscribe to changes of the data for a particular key or set of keys. React components use `withOnyx()` and non-React libs use `Onyx.connect()`.
    3. Get initialized with the current value of that key from persistent storage (Onyx does this by calling `setState()` or triggering the `callback` with the values currently on disk as part of the connection process)
- Subscribing to Onyx keys is done using a constant defined in `ONYXKEYS`. Each Onyx key represents either a collection of items or a specific entry in storage. For example, since all reports are stored as individual keys like `report_1234`, if code needs to know about all the reports (e.g. display a list of them in the nav menu), then it would subscribe to the key `ONYXKEYS.COLLECTION.REPORT`.

### Storage Eviction

Different platforms come with varying storage capacities and Onyx has a way to gracefully fail when those storage limits are encountered. When Onyx fails to set or modify a key the following steps are taken:
1. Onyx looks at a list of recently accessed keys (access is defined as subscribed to or modified) and locates the key that was least recently accessed
2. It then deletes this key and retries the original operation

By default, Onyx will not evict anything from storage and will presume all keys are "unsafe" to remove unless explicitly told otherwise.

**To flag a key as safe for removal:**
- Add the key to the `safeEvictionKeys` option in `Onyx.init(options)`
- Implement `canEvict` in the Onyx config for each component subscribing to a key
- The key will only be deleted when all subscribers return `true` for `canEvict`

e.g.
```js
Onyx.init({
    safeEvictionKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
});
```

```js
export default withOnyx({
    reportActions: {
        key: ({reportID}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}_`,
        canEvict: props => !props.isActiveReport,
    },
})(ReportActionsView);
```

### Benchmarks

Provide the `captureMetrics` boolean flag to `Onyx.init` to capture call statistics

```js
Onyx.init({
    keys: ONYXKEYS,
    safeEvictionKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
    captureMetrics: Config.BENCHMARK_ONYX,
});
```

At any point you can get the collected statistics using `Onyx.getMetrics()`.
This will return an object containing `totalTime`, `averageTime` and `summaries`.
`summaries` is a collection of statistics for each method it contains data about:
  - method name
  - total, max, min, average times for this method calls
  - calls - a list of individual calls with each having: start time; end time; call duration; call arguments
    - start/end times are relative to application launch time - 0.00 being exactly at launch

If you wish to reset the metrics and start over use `Onyx.resetMetrics()`

Finally, there's a `Onyx.printMetrics()` method which prints human statistics information on the dev console
You can use this method during debugging. For example add an `Onyx.printMetrics()` line somewhere in code or call it
through the dev console. It supports 3 popular formats *MD* - human friendly markdown, *CSV* and *JSON*
The default is MD if you want to print another format call `Onyx.printMetrics({ format: 'csv' })` or 
`Onyx.printMetrics({ 'json' })`

Sample output of `Onyx.printMetrics()`

```
### Onyx Benchmark
  - Total: 1.5min
  - Last call finished at: 12.55sec

|     method      | total time spent |    max    |   min    |    avg    | time last call completed | calls made |
|-----------------|-----------------:|----------:|---------:|----------:|-------------------------:|-----------:|
| Onyx:getAllKeys |           1.2min |   2.16sec |  0.159ms | 782.230ms |                 12.55sec |         90 |
| Onyx:merge      |          4.73sec |   2.00sec | 74.412ms | 591.642ms |                 10.24sec |          8 |
| Onyx:set        |          3.90sec | 846.760ms | 43.663ms | 433.056ms |                  7.47sec |          9 |
| Onyx:get        |          8.87sec |   2.00sec |  0.063ms |  61.998ms |                 10.24sec |        143 |


|                           Onyx:set                            |
|---------------------------------------------------------------|
| start time | end time  | duration  |           args           |
|-----------:|----------:|----------:|--------------------------|
|  291.042ms | 553.079ms | 262.037ms | session, [object Object] |
|  293.719ms | 553.316ms | 259.597ms | account, [object Object] |
|  294.541ms | 553.651ms | 259.109ms | network, [object Object] |
|  365.378ms | 554.246ms | 188.867ms | iou, [object Object]     |
|    1.08sec |   2.20sec |   1.12sec | network, [object Object] |
|    1.08sec |   2.20sec |   1.12sec | iou, [object Object]     |
|    1.17sec |   2.20sec |   1.03sec | currentURL, /            |
```
