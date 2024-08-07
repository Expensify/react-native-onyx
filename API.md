<!---These docs were automatically generated. Do not edit them directly run `npm run build:docs` script-->

# API Reference

## Functions

<dl>
<dt><a href="#init">init()</a></dt>
<dd><p>Initialize the store with actions and listening for storage events</p>
</dd>
<dt><a href="#connect">connect(mapping)</a> ⇒</dt>
<dd><p>Subscribes a react component&#39;s state directly to a store key</p>
</dd>
<dt><a href="#disconnect">disconnect(connectionID)</a></dt>
<dd><p>Remove the listener for a react component</p>
</dd>
<dt><a href="#set">set(key, value)</a></dt>
<dd><p>Write a value to our store with the given key</p>
</dd>
<dt><a href="#multiSet">multiSet(data)</a></dt>
<dd><p>Sets multiple keys and values</p>
</dd>
<dt><a href="#merge">merge()</a></dt>
<dd><p>Merge a new value into an existing value at a key.</p>
<p>The types of values that can be merged are <code>Object</code> and <code>Array</code>. To set another type of value use <code>Onyx.set()</code>.
Values of type <code>Object</code> get merged with the old value, whilst for <code>Array</code>&#39;s we simply replace the current value with the new one.</p>
<p>Calls to <code>Onyx.merge()</code> are batched so that any calls performed in a single tick will stack in a queue and get
applied in the order they were called. Note: <code>Onyx.set()</code> calls do not work this way so use caution when mixing
<code>Onyx.merge()</code> and <code>Onyx.set()</code>.</p>
</dd>
<dt><a href="#mergeCollection">mergeCollection(collectionKey, collection)</a></dt>
<dd><p>Merges a collection based on their keys</p>
</dd>
<dt><a href="#clear">clear(keysToPreserve)</a></dt>
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
<dt><a href="#update">update(data)</a> ⇒</dt>
<dd><p>Insert API responses and lifecycle data into Onyx</p>
</dd>
</dl>

<a name="init"></a>

## init()
Initialize the store with actions and listening for storage events

**Kind**: global function  
<a name="connect"></a>

## connect(mapping) ⇒
Subscribes a react component's state directly to a store key

**Kind**: global function  
**Returns**: an ID to use when calling disconnect  

| Param | Description |
| --- | --- |
| mapping | the mapping information to connect Onyx to the components state |
| mapping.key | ONYXKEY to subscribe to |
| [mapping.statePropertyName] | the name of the property in the state to connect the data to |
| [mapping.withOnyxInstance] | whose setState() method will be called with any changed data      This is used by React components to connect to Onyx |
| [mapping.callback] | a method that will be called with changed data      This is used by any non-React code to connect to Onyx |
| [mapping.initWithStoredValues] | If set to false, then no data will be prefilled into the  component |
| [mapping.waitForCollectionCallback] | If set to true, it will return the entire collection to the callback as a single object |
| [mapping.selector] | THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.       The sourceData and withOnyx state are passed to the selector and should return the simplified data. Using this setting on `withOnyx` can have very positive       performance benefits because the component will only re-render when the subset of data changes. Otherwise, any change of data on any property would normally       cause the component to re-render (and that can be expensive from a performance standpoint). |
| [mapping.initialValue] | THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be passed to the component so that something can be rendered while data is being fetched from the DB. Note that it will not cause the component to have the loading prop set to true. |

**Example**  
```js
const connectionID = Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: onSessionChange,
});
```
<a name="disconnect"></a>

## disconnect(connectionID)
Remove the listener for a react component

**Kind**: global function  

| Param | Description |
| --- | --- |
| connectionID | unique id returned by call to Onyx.connect() |

**Example**  
```js
Onyx.disconnect(connectionID);
```
<a name="set"></a>

## set(key, value)
Write a value to our store with the given key

**Kind**: global function  

| Param | Description |
| --- | --- |
| key | ONYXKEY to set |
| value | value to store |

<a name="multiSet"></a>

## multiSet(data)
Sets multiple keys and values

**Kind**: global function  

| Param | Description |
| --- | --- |
| data | object keyed by ONYXKEYS and the values to set |

**Example**  
```js
Onyx.multiSet({'key1': 'a', 'key2': 'b'});
```
<a name="merge"></a>

## merge()
Merge a new value into an existing value at a key.

The types of values that can be merged are `Object` and `Array`. To set another type of value use `Onyx.set()`.
Values of type `Object` get merged with the old value, whilst for `Array`'s we simply replace the current value with the new one.

Calls to `Onyx.merge()` are batched so that any calls performed in a single tick will stack in a queue and get
applied in the order they were called. Note: `Onyx.set()` calls do not work this way so use caution when mixing
`Onyx.merge()` and `Onyx.set()`.

**Kind**: global function  
**Example**  
```js
Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Joe']); // -> ['Joe']
Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Jack']); // -> ['Jack']
Onyx.merge(ONYXKEYS.POLICY, {id: 1}); // -> {id: 1}
Onyx.merge(ONYXKEYS.POLICY, {name: 'My Workspace'}); // -> {id: 1, name: 'My Workspace'}
```
<a name="mergeCollection"></a>

## mergeCollection(collectionKey, collection)
Merges a collection based on their keys

**Kind**: global function  

| Param | Description |
| --- | --- |
| collectionKey | e.g. `ONYXKEYS.COLLECTION.REPORT` |
| collection | Object collection keyed by individual collection member keys and values |

**Example**  
```js
Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, {
    [`${ONYXKEYS.COLLECTION.REPORT}1`]: report1,
    [`${ONYXKEYS.COLLECTION.REPORT}2`]: report2,
});
```
<a name="clear"></a>

## clear(keysToPreserve)
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

| Param | Description |
| --- | --- |
| keysToPreserve | is a list of ONYXKEYS that should not be cleared with the rest of the data |

<a name="update"></a>

## update(data) ⇒
Insert API responses and lifecycle data into Onyx

**Kind**: global function  
**Returns**: resolves when all operations are complete  

| Param | Description |
| --- | --- |
| data | An array of objects with update expressions |

