/**
 * Web default BufferStore implementation.
 *
 * A trivial wrapper around a JS `Map<OnyxKey, BufferEntry>`. This is the
 * default backing store for the WriteBuffer on all platforms that don't
 * provide a native override (i.e., web).
 */
import type {OnyxKey} from '../../types';
import type {BufferEntry} from '../WriteBuffer';
import type BufferStoreType from './types';

function createBufferStore(): BufferStoreType {
    const map = new Map<OnyxKey, BufferEntry>();

    return {
        get(key: OnyxKey): BufferEntry | undefined {
            return map.get(key);
        },
        set(key: OnyxKey, entry: BufferEntry): void {
            map.set(key, entry);
        },
        delete(key: OnyxKey): boolean {
            return map.delete(key);
        },
        has(key: OnyxKey): boolean {
            return map.has(key);
        },
        get size(): number {
            return map.size;
        },
        clear(): void {
            map.clear();
        },
        entries(): IterableIterator<[OnyxKey, BufferEntry]> {
            return map.entries();
        },
    };
}

export default createBufferStore;
export type {BufferStoreType as BufferStore};
