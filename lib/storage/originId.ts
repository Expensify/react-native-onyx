/**
 * Per-tab identifier for the storage worker's BroadcastChannel messages.
 *
 * Minted once per main-thread realm (per browser tab). The id is forwarded to
 * the storage worker via the init message, so the worker can tag every
 * `onyx-sync` broadcast with the originating tab's id. InstanceSync then
 * filters out broadcasts whose id matches this tab, so a write made locally
 * doesn't echo back into the local cache as a structured-cloned duplicate.
 */
const STORAGE_ORIGIN_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `origin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export default STORAGE_ORIGIN_ID;
