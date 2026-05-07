import type {OnyxKey} from '../../types';
import type {BufferEntry} from '../WriteBuffer';

/**
 * Interface for the backing data structure of the WriteBuffer.
 *
 * Platform-specific implementations:
 * - `index.ts` (web default): simple JS `Map` wrapper
 * - `index.native.ts` (iOS/Android): NitroModules HybridObject with
 *   mutex-protected shared C++ memory and background flush thread
 */
interface BufferStore {
    get(key: OnyxKey): BufferEntry | undefined;
    set(key: OnyxKey, entry: BufferEntry): void;
    delete(key: OnyxKey): boolean;
    has(key: OnyxKey): boolean;
    readonly size: number;
    clear(): void;
    entries(): IterableIterator<[OnyxKey, BufferEntry]>;
}

export default BufferStore;
