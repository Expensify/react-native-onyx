<!---These docs were automatically generated. Do not edit them directly run `npm run build:docs` script-->

# Internal API Reference

## Functions

<dl>
<dt><a href="#getMergeQueue">getMergeQueue()</a></dt>
<dd><p>Getter - returns the merge queue.</p>
</dd>
<dt><a href="#getMergeQueuePromise">getMergeQueuePromise()</a></dt>
<dd><p>Getter - returns the merge queue promise.</p>
</dd>
<dt><a href="#getDefaultKeyStates">getDefaultKeyStates()</a></dt>
<dd><p>Getter - returns the default key states.</p>
</dd>
<dt><a href="#getDeferredInitTask">getDeferredInitTask()</a></dt>
<dd><p>Getter - returns the deffered init task.</p>
</dd>
<dt><a href="#getSkippableCollectionMemberIDs">getSkippableCollectionMemberIDs()</a></dt>
<dd><p>Getter - returns the skippable collection member IDs.</p>
</dd>
<dt><a href="#setSkippableCollectionMemberIDs">setSkippableCollectionMemberIDs()</a></dt>
<dd><p>Setter - sets the skippable collection member IDs.</p>
</dd>
<dt><a href="#initStoreValues">initStoreValues(keys, initialKeyStates, evictableKeys, fullyMergedSnapshotKeys)</a></dt>
<dd><p>Sets the initial values for the Onyx store</p>
</dd>
<dt><a href="#maybeFlushBatchUpdates">maybeFlushBatchUpdates()</a></dt>
<dd><p>We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
update operations. Instead of calling the subscribers for each update operation, we batch them together which will
cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.</p>
</dd>
<dt><a href="#reduceCollectionWithSelector">reduceCollectionWithSelector()</a></dt>
<dd><p>Takes a collection of items (eg. {testKey_1:{a:&#39;a&#39;}, testKey_2:{b:&#39;b&#39;}})
and runs it through a reducer function to return a subset of the data according to a selector.
The resulting collection will only contain items that are returned by the selector.</p>
</dd>
<dt><a href="#get">get()</a></dt>
<dd><p>Get some data from the store</p>
</dd>
<dt><a href="#tupleGet">tupleGet()</a></dt>
<dd><p>This helper exists to map an array of Onyx keys such as <code>[&#39;report_&#39;, &#39;conciergeReportID&#39;]</code>
to the values for those keys (correctly typed) such as <code>[OnyxCollection&lt;Report&gt;, OnyxEntry&lt;string&gt;]</code></p>
<p>Note: just using <code>.map</code>, you&#39;d end up with <code>Array&lt;OnyxCollection&lt;Report&gt;|OnyxEntry&lt;string&gt;&gt;</code>, which is not what we want. This preserves the order of the keys provided.</p>
</dd>
<dt><a href="#storeKeyBySubscriptions">storeKeyBySubscriptions(subscriptionID, key)</a></dt>
<dd><p>Stores a subscription ID associated with a given key.</p>
</dd>
<dt><a href="#deleteKeyBySubscriptions">deleteKeyBySubscriptions(subscriptionID)</a></dt>
<dd><p>Deletes a subscription ID associated with its corresponding key.</p>
</dd>
<dt><a href="#getAllKeys">getAllKeys()</a></dt>
<dd><p>Returns current key names stored in persisted storage</p>
</dd>
<dt><a href="#getCollectionKeys">getCollectionKeys()</a></dt>
<dd><p>Returns set of all registered collection keys</p>
</dd>
<dt><a href="#isCollectionKey">isCollectionKey()</a></dt>
<dd><p>Checks to see if the subscriber&#39;s supplied key
is associated with a collection of keys.</p>
</dd>
<dt><a href="#splitCollectionMemberKey">splitCollectionMemberKey(key, collectionKey)</a> ⇒</dt>
<dd><p>Splits a collection member key into the collection key part and the ID part.</p>
</dd>
<dt><a href="#isKeyMatch">isKeyMatch()</a></dt>
<dd><p>Checks to see if a provided key is the exact configured key of our connected subscriber
or if the provided key is a collection member key (in case our configured key is a &quot;collection key&quot;)</p>
</dd>
<dt><a href="#getCollectionKey">getCollectionKey(key)</a> ⇒</dt>
<dd><p>Extracts the collection identifier of a given collection member key.</p>
<p>For example:</p>
<ul>
<li><code>getCollectionKey(&quot;report_123&quot;)</code> would return &quot;report_&quot;</li>
<li><code>getCollectionKey(&quot;report_&quot;)</code> would return &quot;report_&quot;</li>
<li><code>getCollectionKey(&quot;report_-1_something&quot;)</code> would return &quot;report_&quot;</li>
<li><code>getCollectionKey(&quot;sharedNVP_user_-1_something&quot;)</code> would return &quot;sharedNVP_user_&quot;</li>
</ul>
</dd>
<dt><a href="#tryGetCachedValue">tryGetCachedValue()</a></dt>
<dd><p>Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
If the requested key is a collection, it will return an object with all the collection members.</p>
</dd>
<dt><a href="#keysChanged">keysChanged()</a></dt>
<dd><p>When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks</p>
</dd>
<dt><a href="#keyChanged">keyChanged()</a></dt>
<dd><p>When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks</p>
</dd>
<dt><a href="#sendDataToConnection">sendDataToConnection()</a></dt>
<dd><p>Sends the data obtained from the keys to the connection. It either:
    - sets state on the withOnyxInstances
    - triggers the callback function</p>
</dd>
<dt><a href="#addKeyToRecentlyAccessedIfNeeded">addKeyToRecentlyAccessedIfNeeded()</a></dt>
<dd><p>We check to see if this key is flagged as safe for eviction and add it to the recentlyAccessedKeys list so that when we
run out of storage the least recently accessed key can be removed.</p>
</dd>
<dt><a href="#getCollectionDataAndSendAsObject">getCollectionDataAndSendAsObject()</a></dt>
<dd><p>Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.</p>
</dd>
<dt><a href="#scheduleSubscriberUpdate">scheduleSubscriberUpdate()</a></dt>
<dd><p>Schedules an update that will be appended to the macro task queue (so it doesn&#39;t update the subscribers immediately).</p>
</dd>
<dt><a href="#scheduleNotifyCollectionSubscribers">scheduleNotifyCollectionSubscribers()</a></dt>
<dd><p>This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
subscriber callbacks receive the data in a different format than they normally expect and it breaks code.</p>
</dd>
<dt><a href="#remove">remove()</a></dt>
<dd><p>Remove a key from Onyx and update the subscribers</p>
</dd>
<dt><a href="#evictStorageAndRetry">evictStorageAndRetry()</a></dt>
<dd><p>If we fail to set or merge we must handle this by
evicting some data from Onyx and then retrying to do
whatever it is we attempted to do.</p>
</dd>
<dt><a href="#broadcastUpdate">broadcastUpdate()</a></dt>
<dd><p>Notifies subscribers and writes current value to cache</p>
</dd>
<dt><a href="#prepareKeyValuePairsForStorage">prepareKeyValuePairsForStorage()</a> ⇒</dt>
<dd><p>Storage expects array like: [[&quot;@MyApp_user&quot;, value_1], [&quot;@MyApp_key&quot;, value_2]]
This method transforms an object like {&#39;@MyApp_user&#39;: myUserValue, &#39;@MyApp_key&#39;: myKeyValue}
to an array of key-value pairs in the above format and removes key-value pairs that are being set to null</p>
</dd>
<dt><a href="#mergeChanges">mergeChanges(changes, existingValue)</a></dt>
<dd><p>Merges an array of changes with an existing value or creates a single change.</p>
</dd>
<dt><a href="#mergeAndMarkChanges">mergeAndMarkChanges(changes, existingValue)</a></dt>
<dd><p>Merges an array of changes with an existing value or creates a single change.
It will also mark deep nested objects that need to be entirely replaced during the merge.</p>
</dd>
<dt><a href="#mergeInternal">mergeInternal(changes, existingValue)</a></dt>
<dd><p>Merges an array of changes with an existing value or creates a single change.</p>
</dd>
<dt><a href="#initializeWithDefaultKeyStates">initializeWithDefaultKeyStates()</a></dt>
<dd><p>Merge user provided default key value pairs.</p>
</dd>
<dt><a href="#isValidNonEmptyCollectionForMerge">isValidNonEmptyCollectionForMerge()</a></dt>
<dd><p>Validate the collection is not empty and has a correct type before applying mergeCollection()</p>
</dd>
<dt><a href="#doAllCollectionItemsBelongToSameParent">doAllCollectionItemsBelongToSameParent()</a></dt>
<dd><p>Verify if all the collection keys belong to the same parent</p>
</dd>
<dt><a href="#subscribeToKey">subscribeToKey(connectOptions)</a> ⇒</dt>
<dd><p>Subscribes to an Onyx key and listens to its changes.</p>
</dd>
<dt><a href="#unsubscribeFromKey">unsubscribeFromKey(subscriptionID)</a></dt>
<dd><p>Disconnects and removes the listener from the Onyx key.</p>
</dd>
<dt><a href="#mergeCollectionWithPatches">mergeCollectionWithPatches(collectionKey, collection, mergeReplaceNullPatches)</a></dt>
<dd><p>Merges a collection based on their keys.
Serves as core implementation for <code>Onyx.mergeCollection()</code> public function, the difference being
that this internal function allows passing an additional <code>mergeReplaceNullPatches</code> parameter.</p>
</dd>
<dt><a href="#clearOnyxUtilsInternals">clearOnyxUtilsInternals()</a></dt>
<dd><p>Clear internal variables used in this file, useful in test environments.</p>
</dd>
</dl>

<a name="getMergeQueue"></a>

## getMergeQueue()
Getter - returns the merge queue.

**Kind**: global function  
<a name="getMergeQueuePromise"></a>

## getMergeQueuePromise()
Getter - returns the merge queue promise.

**Kind**: global function  
<a name="getDefaultKeyStates"></a>

## getDefaultKeyStates()
Getter - returns the default key states.

**Kind**: global function  
<a name="getDeferredInitTask"></a>

## getDeferredInitTask()
Getter - returns the deffered init task.

**Kind**: global function  
<a name="getSkippableCollectionMemberIDs"></a>

## getSkippableCollectionMemberIDs()
Getter - returns the skippable collection member IDs.

**Kind**: global function  
<a name="setSkippableCollectionMemberIDs"></a>

## setSkippableCollectionMemberIDs()
Setter - sets the skippable collection member IDs.

**Kind**: global function  
<a name="initStoreValues"></a>

## initStoreValues(keys, initialKeyStates, evictableKeys, fullyMergedSnapshotKeys)
Sets the initial values for the Onyx store

**Kind**: global function  

| Param | Description |
| --- | --- |
| keys | `ONYXKEYS` constants object from Onyx.init() |
| initialKeyStates | initial data to set when `init()` and `clear()` are called |
| evictableKeys | This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal. |
| fullyMergedSnapshotKeys | Array of snapshot collection keys where full merge is supported and data structure can be changed after merge. |

<a name="maybeFlushBatchUpdates"></a>

## maybeFlushBatchUpdates()
We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
update operations. Instead of calling the subscribers for each update operation, we batch them together which will
cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.

**Kind**: global function  
<a name="reduceCollectionWithSelector"></a>

## reduceCollectionWithSelector()
Takes a collection of items (eg. {testKey_1:{a:'a'}, testKey_2:{b:'b'}})
and runs it through a reducer function to return a subset of the data according to a selector.
The resulting collection will only contain items that are returned by the selector.

**Kind**: global function  
<a name="get"></a>

## get()
Get some data from the store

**Kind**: global function  
<a name="tupleGet"></a>

## tupleGet()
This helper exists to map an array of Onyx keys such as `['report_', 'conciergeReportID']`
to the values for those keys (correctly typed) such as `[OnyxCollection<Report>, OnyxEntry<string>]`

Note: just using `.map`, you'd end up with `Array<OnyxCollection<Report>|OnyxEntry<string>>`, which is not what we want. This preserves the order of the keys provided.

**Kind**: global function  
<a name="storeKeyBySubscriptions"></a>

## storeKeyBySubscriptions(subscriptionID, key)
Stores a subscription ID associated with a given key.

**Kind**: global function  

| Param | Description |
| --- | --- |
| subscriptionID | A subscription ID of the subscriber. |
| key | A key that the subscriber is subscribed to. |

<a name="deleteKeyBySubscriptions"></a>

## deleteKeyBySubscriptions(subscriptionID)
Deletes a subscription ID associated with its corresponding key.

**Kind**: global function  

| Param | Description |
| --- | --- |
| subscriptionID | The subscription ID to be deleted. |

<a name="getAllKeys"></a>

## getAllKeys()
Returns current key names stored in persisted storage

**Kind**: global function  
<a name="getCollectionKeys"></a>

## getCollectionKeys()
Returns set of all registered collection keys

**Kind**: global function  
<a name="isCollectionKey"></a>

## isCollectionKey()
Checks to see if the subscriber's supplied key
is associated with a collection of keys.

**Kind**: global function  
<a name="splitCollectionMemberKey"></a>

## splitCollectionMemberKey(key, collectionKey) ⇒
Splits a collection member key into the collection key part and the ID part.

**Kind**: global function  
**Returns**: A tuple where the first element is the collection part and the second element is the ID part,
or throws an Error if the key is not a collection one.  

| Param | Description |
| --- | --- |
| key | The collection member key to split. |
| collectionKey | The collection key of the `key` param that can be passed in advance to optimize the function. |

<a name="isKeyMatch"></a>

## isKeyMatch()
Checks to see if a provided key is the exact configured key of our connected subscriber
or if the provided key is a collection member key (in case our configured key is a "collection key")

**Kind**: global function  
<a name="getCollectionKey"></a>

## getCollectionKey(key) ⇒
Extracts the collection identifier of a given collection member key.

For example:
- `getCollectionKey("report_123")` would return "report_"
- `getCollectionKey("report_")` would return "report_"
- `getCollectionKey("report_-1_something")` would return "report_"
- `getCollectionKey("sharedNVP_user_-1_something")` would return "sharedNVP_user_"

**Kind**: global function  
**Returns**: The plain collection key or throws an Error if the key is not a collection one.  

| Param | Description |
| --- | --- |
| key | The collection key to process. |

<a name="tryGetCachedValue"></a>

## tryGetCachedValue()
Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
If the requested key is a collection, it will return an object with all the collection members.

**Kind**: global function  
<a name="keysChanged"></a>

## keysChanged()
When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks

**Kind**: global function  

* [keysChanged()](#keysChanged)
    * [~isSubscribedToCollectionKey](#keysChanged..isSubscribedToCollectionKey)
    * [~isSubscribedToCollectionMemberKey](#keysChanged..isSubscribedToCollectionMemberKey)

<a name="keysChanged..isSubscribedToCollectionKey"></a>

### keysChanged~isSubscribedToCollectionKey
e.g. Onyx.connect({key: ONYXKEYS.COLLECTION.REPORT, callback: ...});

**Kind**: inner constant of [<code>keysChanged</code>](#keysChanged)  
<a name="keysChanged..isSubscribedToCollectionMemberKey"></a>

### keysChanged~isSubscribedToCollectionMemberKey
e.g. Onyx.connect({key: `${ONYXKEYS.COLLECTION.REPORT}{reportID}`, callback: ...});

**Kind**: inner constant of [<code>keysChanged</code>](#keysChanged)  
<a name="keyChanged"></a>

## keyChanged()
When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks

**Kind**: global function  
**Example**  
```js
keyChanged(key, value, subscriber => subscriber.initWithStoredValues === false)
```
<a name="sendDataToConnection"></a>

## sendDataToConnection()
Sends the data obtained from the keys to the connection. It either:
    - sets state on the withOnyxInstances
    - triggers the callback function

**Kind**: global function  
<a name="addKeyToRecentlyAccessedIfNeeded"></a>

## addKeyToRecentlyAccessedIfNeeded()
We check to see if this key is flagged as safe for eviction and add it to the recentlyAccessedKeys list so that when we
run out of storage the least recently accessed key can be removed.

**Kind**: global function  
<a name="getCollectionDataAndSendAsObject"></a>

## getCollectionDataAndSendAsObject()
Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.

**Kind**: global function  
<a name="scheduleSubscriberUpdate"></a>

## scheduleSubscriberUpdate()
Schedules an update that will be appended to the macro task queue (so it doesn't update the subscribers immediately).

**Kind**: global function  
**Example**  
```js
scheduleSubscriberUpdate(key, value, subscriber => subscriber.initWithStoredValues === false)
```
<a name="scheduleNotifyCollectionSubscribers"></a>

## scheduleNotifyCollectionSubscribers()
This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
subscriber callbacks receive the data in a different format than they normally expect and it breaks code.

**Kind**: global function  
<a name="remove"></a>

## remove()
Remove a key from Onyx and update the subscribers

**Kind**: global function  
<a name="evictStorageAndRetry"></a>

## evictStorageAndRetry()
If we fail to set or merge we must handle this by
evicting some data from Onyx and then retrying to do
whatever it is we attempted to do.

**Kind**: global function  
<a name="broadcastUpdate"></a>

## broadcastUpdate()
Notifies subscribers and writes current value to cache

**Kind**: global function  
<a name="prepareKeyValuePairsForStorage"></a>

## prepareKeyValuePairsForStorage() ⇒
Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
to an array of key-value pairs in the above format and removes key-value pairs that are being set to null

**Kind**: global function  
**Returns**: an array of key - value pairs <[key, value]>  
<a name="mergeChanges"></a>

## mergeChanges(changes, existingValue)
Merges an array of changes with an existing value or creates a single change.

**Kind**: global function  

| Param | Description |
| --- | --- |
| changes | Array of changes that should be merged |
| existingValue | The existing value that should be merged with the changes |

<a name="mergeAndMarkChanges"></a>

## mergeAndMarkChanges(changes, existingValue)
Merges an array of changes with an existing value or creates a single change.
It will also mark deep nested objects that need to be entirely replaced during the merge.

**Kind**: global function  

| Param | Description |
| --- | --- |
| changes | Array of changes that should be merged |
| existingValue | The existing value that should be merged with the changes |

<a name="mergeInternal"></a>

## mergeInternal(changes, existingValue)
Merges an array of changes with an existing value or creates a single change.

**Kind**: global function  

| Param | Description |
| --- | --- |
| changes | Array of changes that should be merged |
| existingValue | The existing value that should be merged with the changes |

<a name="initializeWithDefaultKeyStates"></a>

## initializeWithDefaultKeyStates()
Merge user provided default key value pairs.

**Kind**: global function  
<a name="isValidNonEmptyCollectionForMerge"></a>

## isValidNonEmptyCollectionForMerge()
Validate the collection is not empty and has a correct type before applying mergeCollection()

**Kind**: global function  
<a name="doAllCollectionItemsBelongToSameParent"></a>

## doAllCollectionItemsBelongToSameParent()
Verify if all the collection keys belong to the same parent

**Kind**: global function  
<a name="subscribeToKey"></a>

## subscribeToKey(connectOptions) ⇒
Subscribes to an Onyx key and listens to its changes.

**Kind**: global function  
**Returns**: The subscription ID to use when calling `OnyxUtils.unsubscribeFromKey()`.  

| Param | Description |
| --- | --- |
| connectOptions | The options object that will define the behavior of the connection. |

<a name="unsubscribeFromKey"></a>

## unsubscribeFromKey(subscriptionID)
Disconnects and removes the listener from the Onyx key.

**Kind**: global function  

| Param | Description |
| --- | --- |
| subscriptionID | Subscription ID returned by calling `OnyxUtils.subscribeToKey()`. |

<a name="mergeCollectionWithPatches"></a>

## mergeCollectionWithPatches(collectionKey, collection, mergeReplaceNullPatches)
Merges a collection based on their keys.
Serves as core implementation for `Onyx.mergeCollection()` public function, the difference being
that this internal function allows passing an additional `mergeReplaceNullPatches` parameter.

**Kind**: global function  

| Param | Description |
| --- | --- |
| collectionKey | e.g. `ONYXKEYS.COLLECTION.REPORT` |
| collection | Object collection keyed by individual collection member keys and values |
| mergeReplaceNullPatches | Record where the key is a collection member key and the value is a list of tuples that we'll use to replace the nested objects of that collection member record with something else. |

<a name="clearOnyxUtilsInternals"></a>

## clearOnyxUtilsInternals()
Clear internal variables used in this file, useful in test environments.

**Kind**: global function  
