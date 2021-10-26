<!---These docs were automatically generated. Do not edit them directly run `npm run build-docs` script-->

# API Reference

## Functions

<dl>
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
<dt><a href="#hasPendingMergeForKey">hasPendingMergeForKey(key)</a> ⇒ <code>Boolean</code></dt>
<dd></dd>
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
<dt><a href="#initializeWithDefaultKeyStates">initializeWithDefaultKeyStates()</a> ⇒ <code>Promise</code></dt>
<dd><p>Merge user provided default key value pairs.</p>
</dd>
<dt><a href="#clear">clear()</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Clear out all the data in the store</p>
</dd>
<dt><a href="#mergeCollection">mergeCollection(collectionKey, collection)</a> ⇒ <code>Promise</code></dt>
<dd><p>Merges a collection based on their keys.</p>
</dd>
<dt><a href="#init">init(options, registerStorageEventListener)</a></dt>
<dd><p>Initialize the store with actions and listening for storage events</p>
</dd>
<dt><a href="#applyDecorators">applyDecorators()</a></dt>
<dd><p>Apply calls statistic decorators to benchmark Onyx</p>
</dd>
</dl>

<a name="connect"></a>

## connect(mapping) ⇒ <code>Number</code>
Subscribes a react component's state directly to a store key

**Kind**: global function
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

**Kind**: global function

| Param | Type |
| --- | --- |
| connectionID | <code>Number</code> |
| [keyToRemoveFromEvictionBlocklist] | <code>String</code> |

<a name="set"></a>

## set(key, val) ⇒ <code>Promise</code>
Write a value to our store with the given key

**Kind**: global function

| Param | Type |
| --- | --- |
| key | <code>string</code> |
| val | <code>mixed</code> |

<a name="multiSet"></a>

## multiSet(data) ⇒ <code>Promise</code>
Sets multiple keys and values. Example
Onyx.multiSet({'key1': 'a', 'key2': 'b'});

**Kind**: global function

| Param | Type |
| --- | --- |
| data | <code>object</code> |

<a name="hasPendingMergeForKey"></a>

## hasPendingMergeForKey(key) ⇒ <code>Boolean</code>
**Kind**: global function

| Param | Type |
| --- | --- |
| key | <code>String</code> |

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

**Kind**: global function

| Param | Type |
| --- | --- |
| key | <code>String</code> |
| value | <code>\*</code> |

<a name="initializeWithDefaultKeyStates"></a>

## initializeWithDefaultKeyStates() ⇒ <code>Promise</code>
Merge user provided default key value pairs.

**Kind**: global function
<a name="clear"></a>

## clear() ⇒ <code>Promise.&lt;void&gt;</code>
Clear out all the data in the store

**Kind**: global function
<a name="mergeCollection"></a>

## mergeCollection(collectionKey, collection) ⇒ <code>Promise</code>
Merges a collection based on their keys.

**Kind**: global function

| Param | Type |
| --- | --- |
| collectionKey | <code>String</code> |
| collection | <code>Object</code> |

<a name="init"></a>

## init(options, registerStorageEventListener)
Initialize the store with actions and listening for storage events

**Kind**: global function

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  |  |
| [options.keys] | <code>Object</code> |  |  |
| [options.initialKeyStates] | <code>Object</code> |  |  |
| [options.safeEvictionKeys] | <code>Array.&lt;String&gt;</code> |  | This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal. Any components subscribing to these keys must also implement a canEvict option. See the README for more info. |
| registerStorageEventListener | <code>function</code> |  | a callback when a storage event happens. This applies to web platforms where the local storage emits storage events across all open tabs and allows Onyx to stay in sync across all open tabs. |
| [options.maxCachedKeysCount] | <code>Number</code> | <code>55</code> | Sets how many recent keys should we try to keep in cache Setting this to 0 would practically mean no cache We try to free cache when we connect to a safe eviction key |
| [options.captureMetrics] | <code>Boolean</code> |  | Enables Onyx benchmarking and exposes the get/print/reset functions |

<a name="applyDecorators"></a>

## applyDecorators()
Apply calls statistic decorators to benchmark Onyx

**Kind**: global function
