<!---These docs were automatically generated. Do not edit them directly run `npm run build-docs` script-->

# API Reference

## Functions

<dl>
<dt><a href="#getSubsetOfData">getSubsetOfData(sourceData, selector)</a> ⇒ <code><a href="#JSONValue">JSONValue</a></code></dt>
<dd><p>Uses a selector string or function to return a simplified version of sourceData</p>
</dd>
<dt><a href="#reduceCollectionWithSelector">reduceCollectionWithSelector(collection, selector)</a> ⇒ <code>object</code></dt>
<dd><p>Takes a collection of items (eg. {testKey_1:{a:&#39;a&#39;}, testKey_2:{b:&#39;b&#39;}})
and runs it through a reducer function to return a subset of the data according to a selector.
The resulting collection will only contain items that are returned by the selector.</p>
</dd>
<dt><a href="#isCollectionMemberKey">isCollectionMemberKey(collectionKey, key)</a> ⇒ <code>boolean</code></dt>
<dd></dd>
<dt><a href="#connect">connect(mapping)</a> ⇒ <code>number</code></dt>
<dd><p>Subscribes a react component&#39;s state directly to a store key</p>
</dd>
<dt><a href="#disconnect">disconnect(connectionID, [keyToRemoveFromEvictionBlocklist])</a></dt>
<dd><p>Remove the listener for a react component</p>
</dd>
<dt><a href="#notifySubscribersOnNextTick">notifySubscribersOnNextTick(key, value, [canUpdateSubscriber])</a></dt>
<dd><p>This method mostly exists for historical reasons as this library was initially designed without a memory cache and one was added later.
For this reason, Onyx works more similar to what you might expect from a native AsyncStorage with reads, writes, etc all becoming
available async. Since we have code in our main applications that might expect things to work this way it&#39;s not safe to change this
behavior just yet.</p>
</dd>
<dt><a href="#notifyCollectionSubscribersOnNextTick">notifyCollectionSubscribersOnNextTick(key, value)</a></dt>
<dd><p>This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
subscriber callbacks receive the data in a different format than they normally expect and it breaks code.</p>
</dd>
<dt><a href="#set">set(key, value)</a> ⇒ <code>Promise</code></dt>
<dd><p>Write a value to our store with the given key</p>
</dd>
<dt><a href="#multiSet">multiSet(data)</a> ⇒ <code>Promise</code></dt>
<dd><p>Sets multiple keys and values</p>
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
<dt><a href="#clear">clear(keysToPreserve)</a> ⇒ <code>Promise</code></dt>
<dd><p>Clear out all the data in the store</p>
<p>Note that calling Onyx.clear() and then Onyx.set() on a key with a default
key state may store an unexpected value in Storage.</p>
<p>E.g.
Onyx.clear();
Onyx.set(ONYXKEYS.DEFAULT_KEY, &#39;default&#39;);
Storage.getItem(ONYXKEYS.DEFAULT_KEY)
    .then((storedValue) =&gt; console.log(storedValue));
null is logged instead of the expected &#39;default&#39;</p>
<p>Onyx.set() might call Storage.setItem() before Onyx.clear() calls
Storage.setItem(). Use Onyx.merge() instead if possible. Onyx.merge() calls
Onyx.get(key) before calling Storage.setItem() via Onyx.set().
Storage.setItem() from Onyx.clear() will have already finished and the merged
value will be saved to storage after the default value.</p>
</dd>
<dt><a href="#mergeCollection">mergeCollection(collectionKey, collection)</a> ⇒ <code>Promise</code></dt>
<dd><p>Merges a collection based on their keys</p>
</dd>
<dt><a href="#update">update(data)</a> ⇒ <code>Promise</code></dt>
<dd><p>Insert API responses and lifecycle data into Onyx</p>
</dd>
<dt><a href="#init">init([options])</a></dt>
<dd><p>Initialize the store with actions and listening for storage events</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#JSONValue">JSONValue</a> : <code>null</code> | <code>undefined</code> | <code>string</code> | <code>boolean</code> | <code>object</code> | <code>number</code></dt>
<dd></dd>
<dt><a href="#Mapping">Mapping</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#KeyValuePairArray">KeyValuePairArray</a> : <code>Array.&lt;Array.&lt;string, JSONValue&gt;&gt;</code></dt>
<dd></dd>
<dt><a href="#OnyxUpdate">OnyxUpdate</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#OnyxConfig">OnyxConfig</a> : <code>object</code></dt>
<dd></dd>
</dl>

<a name="getSubsetOfData"></a>

## getSubsetOfData(sourceData, selector) ⇒ [<code>JSONValue</code>](#JSONValue)
Uses a selector string or function to return a simplified version of sourceData

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| sourceData | <code>object</code> |  |
| selector | <code>string</code> \| <code>function</code> | If it's a string, the selector is passed to lodashGet on the sourceData      If it's a function, it is passed the sourceData and it should return the simplified data |

<a name="reduceCollectionWithSelector"></a>

## reduceCollectionWithSelector(collection, selector) ⇒ <code>object</code>
Takes a collection of items (eg. {testKey_1:{a:'a'}, testKey_2:{b:'b'}})
and runs it through a reducer function to return a subset of the data according to a selector.
The resulting collection will only contain items that are returned by the selector.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| collection | <code>object</code> |  |
| selector | <code>string</code> \| <code>function</code> | (see method docs for getSubsetOfData() for full details) |

<a name="isCollectionMemberKey"></a>

## isCollectionMemberKey(collectionKey, key) ⇒ <code>boolean</code>
**Kind**: global function  

| Param | Type |
| --- | --- |
| collectionKey | <code>string</code> | 
| key | <code>string</code> | 

<a name="connect"></a>

## connect(mapping) ⇒ <code>number</code>
Subscribes a react component's state directly to a store key

**Kind**: global function  
**Returns**: <code>number</code> - an ID to use when calling disconnect  

| Param | Type | Description |
| --- | --- | --- |
| mapping | [<code>Mapping</code>](#Mapping) | the mapping information to connect Onyx to the components state |

**Example**  
```js
const connectionID = Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: onSessionChange,
});
```
<a name="disconnect"></a>

## disconnect(connectionID, [keyToRemoveFromEvictionBlocklist])
Remove the listener for a react component

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| connectionID | <code>number</code> | unique id returned by call to Onyx.connect() |
| [keyToRemoveFromEvictionBlocklist] | <code>string</code> |  |

**Example**  
```js
Onyx.disconnect(connectionID);
```
<a name="notifySubscribersOnNextTick"></a>

## notifySubscribersOnNextTick(key, value, [canUpdateSubscriber])
This method mostly exists for historical reasons as this library was initially designed without a memory cache and one was added later.
For this reason, Onyx works more similar to what you might expect from a native AsyncStorage with reads, writes, etc all becoming
available async. Since we have code in our main applications that might expect things to work this way it's not safe to change this
behavior just yet.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> |  |
| value | [<code>JSONValue</code>](#JSONValue) |  |
| [canUpdateSubscriber] | <code>function</code> | only subscribers that pass this truth test will be updated |

**Example**  
```js
notifySubscribersOnNextTick(key, value, subscriber => subscriber.initWithStoredValues === false)
```
<a name="notifyCollectionSubscribersOnNextTick"></a>

## notifyCollectionSubscribersOnNextTick(key, value)
This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
subscriber callbacks receive the data in a different format than they normally expect and it breaks code.

**Kind**: global function  

| Param | Type |
| --- | --- |
| key | <code>String</code> | 
| value | <code>any</code> | 

<a name="set"></a>

## set(key, value) ⇒ <code>Promise</code>
Write a value to our store with the given key

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ONYXKEY to set |
| value | [<code>JSONValue</code>](#JSONValue) | value to store |

<a name="multiSet"></a>

## multiSet(data) ⇒ <code>Promise</code>
Sets multiple keys and values

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | object keyed by ONYXKEYS and the values to set |

**Example**  
```js
Onyx.multiSet({'key1': 'a', 'key2': 'b'});
```
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

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ONYXKEYS key |
| value | <code>object</code> \| <code>array</code> | Object or Array value to merge |

**Example**  
```js
Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Joe']); // -> ['Joe']
Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Jack']); // -> ['Joe', 'Jack']
Onyx.merge(ONYXKEYS.POLICY, {id: 1}); // -> {id: 1}
Onyx.merge(ONYXKEYS.POLICY, {name: 'My Workspace'}); // -> {id: 1, name: 'My Workspace'}
```
<a name="clear"></a>

## clear(keysToPreserve) ⇒ <code>Promise</code>
Clear out all the data in the store

Note that calling Onyx.clear() and then Onyx.set() on a key with a default
key state may store an unexpected value in Storage.

E.g.
Onyx.clear();
Onyx.set(ONYXKEYS.DEFAULT_KEY, 'default');
Storage.getItem(ONYXKEYS.DEFAULT_KEY)
    .then((storedValue) => console.log(storedValue));
null is logged instead of the expected 'default'

Onyx.set() might call Storage.setItem() before Onyx.clear() calls
Storage.setItem(). Use Onyx.merge() instead if possible. Onyx.merge() calls
Onyx.get(key) before calling Storage.setItem() via Onyx.set().
Storage.setItem() from Onyx.clear() will have already finished and the merged
value will be saved to storage after the default value.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| keysToPreserve | <code>Array.&lt;string&gt;</code> | is a list of ONYXKEYS that should not be cleared with the rest of the data |

<a name="mergeCollection"></a>

## mergeCollection(collectionKey, collection) ⇒ <code>Promise</code>
Merges a collection based on their keys

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| collectionKey | <code>string</code> | e.g. `ONYXKEYS.COLLECTION.REPORT` |
| collection | <code>object</code> | Object collection keyed by individual collection member keys and values |

**Example**  
```js
Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, {
    [`${ONYXKEYS.COLLECTION.REPORT}1`]: report1,
    [`${ONYXKEYS.COLLECTION.REPORT}2`]: report2,
});
```
<a name="update"></a>

## update(data) ⇒ <code>Promise</code>
Insert API responses and lifecycle data into Onyx

**Kind**: global function  

| Param | Type |
| --- | --- |
| data | [<code>Array.&lt;OnyxUpdate&gt;</code>](#OnyxUpdate) | 

<a name="init"></a>

## init([options])
Initialize the store with actions and listening for storage events

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | [<code>OnyxConfig</code>](#OnyxConfig) | <code>{}</code> | config object |

**Example**  
```js
Onyx.init({
    keys: ONYXKEYS,
    initialKeyStates: {
        [ONYXKEYS.SESSION]: {loading: false},
    },
});
```
<a name="JSONValue"></a>

## JSONValue : <code>null</code> \| <code>undefined</code> \| <code>string</code> \| <code>boolean</code> \| <code>object</code> \| <code>number</code>
**Kind**: global typedef  
<a name="Mapping"></a>

## Mapping : <code>object</code>
**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ONYXKEY to subscribe to |
| connectionID | <code>number</code> |  |
| [statePropertyName] | <code>string</code> | the name of the property in the state to connect the data to |
| [withOnyxInstance] | <code>object</code> | whose setState() method will be called with any changed data      This is used by React components to connect to Onyx |
| [callback] | <code>function</code> | a method that will be called with changed data      This is used by any non-React code to connect to Onyx |
| [initWithStoredValues] | <code>boolean</code> | If set to false, then no data will be prefilled into the  component |
| [waitForCollectionCallback] | <code>boolean</code> | If set to true, it will return the entire collection to the callback as a single object |
| [selector] | <code>string</code> \| <code>function</code> | THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.       If the selector is a string, the selector is passed to lodashGet on the sourceData. If the selector is a function, the sourceData is passed to the selector and should return the       simplified data. Using this setting on `withOnyx` can have very positive performance benefits because the component will only re-render when the subset of data changes.       Otherwise, any change of data on any property would normally cause the component to re-render (and that can be expensive from a performance standpoint). |

<a name="KeyValuePairArray"></a>

## KeyValuePairArray : <code>Array.&lt;Array.&lt;string, JSONValue&gt;&gt;</code>
**Kind**: global typedef  
<a name="OnyxUpdate"></a>

## OnyxUpdate : <code>object</code>
**Kind**: global typedef  

| Param | Type |
| --- | --- |
| onyxMethod | <code>&#x27;set&#x27;</code> \| <code>&#x27;merge&#x27;</code> \| <code>&#x27;mergecollection&#x27;</code> \| <code>&#x27;clear&#x27;</code> | 
| key | <code>string</code> | 
| value | [<code>JSONValue</code>](#JSONValue) | 

<a name="OnyxConfig"></a>

## OnyxConfig : <code>object</code>
**Kind**: global typedef  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [keys] | <code>object</code> | <code>{}</code> | `ONYXKEYS` constants object |
| [initialKeyStates] | <code>object</code> | <code>{}</code> | initial data to set when `init()` and `clear()` is called |
| [safeEvictionKeys] | <code>Array.&lt;string&gt;</code> | <code>[]</code> | This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal. Any components subscribing to these keys must also implement a canEvict option. See the README for more info. |
| [maxCachedKeysCount] | <code>number</code> | <code>55</code> | Sets how many recent keys should we try to keep in cache Setting this to 0 would practically mean no cache We try to free cache when we connect to a safe eviction key |
| [captureMetrics] | <code>boolean</code> | <code>false</code> | Enables Onyx benchmarking and exposes the get/print/reset functions |
| [shouldSyncMultipleInstances] | <code>boolean</code> |  | Auto synchronize storage events between multiple instances of Onyx running in different tabs/windows. Defaults to true for platforms that support local storage (web/desktop) |
| [debugSetState] | <code>boolean</code> | <code>false</code> | Enables debugging setState() calls to connected components. |

