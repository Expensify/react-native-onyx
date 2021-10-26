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

# API Reference

<dl>
<dt><a href="#init">init(options, registerStorageEventListener)</a></dt>
<dd><p>Initialize the store with actions and listening for storage events</p>
</dd>
<dt><a href="#connect">connect(mapping)</a> ⇒ <code>Number</code></dt>
<dd><p>Subscribes a react component&#39;s state directly to a store key</p>
</dd>
<dt><a href="#disconnect">disconnect(connectionID, [keyToRemoveFromEvictionBlocklist])</a></dt>
<dd><p>Remove the listener for a react component</p>
</dd>
<dt><a href="#set">set(key, val)</a> ⇒ <code>Promise</code></dt>
<dd><p>Write a value to our store with the given key</p>
</dd>
<dt><a href="#multiSet">multiSet(data)</a> ⇒ <code>Promise</code></dt>
<dd><p>Sets multiple keys and values. Example
Onyx.multiSet({&#39;key1&#39;: &#39;a&#39;, &#39;key2&#39;: &#39;b&#39;});</p>
</dd>
<dt><a href="#merge">merge(key, value)</a> ⇒ <code>Promise</code></dt>
<dd><p>Merge a new value into an existing value at a key.</p>
<p>The types of values that can be merged are <code>Object</code> and <code>Array</code>. To set another type of value use <code>Onyx.set()</code>. Merge
behavior uses lodash/merge under the hood for <code>Object</code> and simple concatenation for <code>Array</code>. However, it&#39;s important
to note that if you have an array value property on an <code>Object</code> that the default behavior of lodash/merge is not to
concatenate. See here: <a href="https://github.com/lodash/lodash/issues/2872">https://github.com/lodash/lodash/issues/2872</a></p>
<p>Calls to <code>Onyx.merge()</code> are batched so that any calls performed in a single tick will stack in a queue and get
applied in the order they were called. Note: <code>Onyx.set()</code> calls do not work this way so use caution when mixing
<code>Onyx.merge()</code> and <code>Onyx.set()</code>.</p>
</dd>
<dt><a href="#clear">clear()</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Clear out all the data in the store</p>
</dd>
<dt><a href="#mergeCollection">mergeCollection(collectionKey, collection)</a> ⇒ <code>Promise</code></dt>
<dd><p>Merges a collection based on their keys.</p>
</dd>
</dl>

<a name="init"></a>

## init(options, registerStorageEventListener)
Initialize the store with actions and listening for storage events

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  |  |
| [options.keys] | <code>Object</code> |  |  |
| [options.initialKeyStates] | <code>Object</code> |  |  |
| [options.safeEvictionKeys] | <code>Array.&lt;String&gt;</code> |  | This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal. Any components subscribing to these keys must also implement a canEvict option. See the README for more info. |
| registerStorageEventListener | <code>function</code> |  | a callback when a storage event happens. This applies to web platforms where the local storage emits storage events across all open tabs and allows Onyx to stay in sync across all open tabs. |
| [options.maxCachedKeysCount] | <code>Number</code> | <code>55</code> | Sets how many recent keys should we try to keep in cache Setting this to 0 would practically mean no cache We try to free cache when we connect to a safe eviction key |
| [options.captureMetrics] | <code>Boolean</code> |  | Enables Onyx benchmarking and exposes the get/print/reset functions |

<a name="connect"></a>

## connect(mapping) ⇒ <code>Number</code>
Subscribes a react component's state directly to a store key

**Returns**: <code>Number</code> - an ID to use when calling disconnect

| Param | Type | Description |
| --- | --- | --- |
| mapping | <code>Object</code> | the mapping information to connect Onyx to the components state |
| mapping.key | <code>String</code> |  |
| mapping.statePropertyName | <code>String</code> | the name of the property in the state to connect the data to |
| [mapping.withOnyxInstance] | <code>Object</code> | whose setState() method will be called with any changed data      This is used by React components to connect to Onyx |
| [mapping.callback] | <code>Object</code> | a method that will be called with changed data      This is used by any non-React code to connect to Onyx |
| [mapping.initWithStoredValues] | <code>Boolean</code> | If set to false, then no data will be prefilled into the  component |

<a name="disconnect"></a>

## disconnect(connectionID, [keyToRemoveFromEvictionBlocklist])
Remove the listener for a react component

| Param | Type |
| --- | --- |
| connectionID | <code>Number</code> |
| [keyToRemoveFromEvictionBlocklist] | <code>String</code> |

<a name="set"></a>

## set(key, val) ⇒ <code>Promise</code>
Write a value to our store with the given key

| Param | Type |
| --- | --- |
| key | <code>string</code> |
| val | <code>mixed</code> |

<a name="multiSet"></a>

## multiSet(data) ⇒ <code>Promise</code>
Sets multiple keys and values. Example
Onyx.multiSet({'key1': 'a', 'key2': 'b'});

| Param | Type |
| --- | --- |
| data | <code>object</code> |

<a name="merge"></a>

## merge(key, value) ⇒ <code>Promise</code>
Merge a new value into an existing value at a key.

The types of values that can be merged are `Object` and `Array`. To set another type of value use `Onyx.set()`. Merge
behavior uses lodash/merge under the hood for `Object` and simple concatenation for `Array`. However, it's important
to note that if you have an array value property on an `Object` that the default behavior of lodash/merge is not to
concatenate. See here: https://github.com/lodash/lodash/issues/2872

Calls to `Onyx.merge()` are batched so that any calls performed in a single tick will stack in a queue and get
applied in the order they were called. Note: `Onyx.set()` calls do not work this way so use caution when mixing
`Onyx.merge()` and `Onyx.set()`.

| Param | Type |
| --- | --- |
| key | <code>String</code> |
| value | <code>\*</code> |

<a name="clear"></a>

## clear() ⇒ <code>Promise.&lt;void&gt;</code>
Clear out all the data in the store

<a name="mergeCollection"></a>

## mergeCollection(collectionKey, collection) ⇒ <code>Promise</code>
Merges a collection based on their keys.

| Param | Type |
| --- | --- |
| collectionKey | <code>String</code> |
| collection | <code>Object</code> |

# Storage Eviction

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
`Onyx.printMetrics({ format: 'json' })`

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
