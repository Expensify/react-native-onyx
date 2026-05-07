/**
 * NativeBufferStore -- Thread-safe buffer backed by a shared_mutex.
 *
 * This is the C++ backing store for the native (iOS/Android) BufferStore
 * HybridObject. It provides a simple key-value buffer where:
 *
 * - The main JS thread populates entries via set()
 * - The Worklet Worker Runtime drains all entries atomically via drain()
 *
 * Thread safety:
 * - Read methods (get, has, size) use shared_lock (concurrent readers OK)
 * - Write methods (set, erase, clear) use unique_lock (exclusive access)
 * - drain() uses unique_lock and atomically swaps out the entire buffer
 *
 * This class stores values as AnyValue-equivalent C++ types (std::string
 * for JSON, since the actual AnyMap-to-JSON serialization happens on the
 * Worklet Worker Runtime side after draining). The Worklet Worker Runtime
 * handles JSON.stringify and calls react-native-nitro-sqlite for persistence.
 *
 * Future optimization: store AnyMap values directly (no JSON strings) and
 * serialize to JSON using Glaze on a pure C++ worker thread, eliminating
 * the JS round-trip entirely.
 */

#pragma once

#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace onyx {

/**
 * Entry types matching the TypeScript BufferEntry.entryType.
 */
enum class NativeEntryType {
    Set,
    Merge,
};

/**
 * A single buffer entry, storing the key, JSON value, and type.
 *
 * The value is stored as a JSON string. In the current architecture,
 * Nitro's JSIConverter converts JS objects to AnyValue (deep C++ copy)
 * on the main thread. The Worklet Worker Runtime then calls drain(),
 * converts AnyValue back to JS objects (on the worker thread), and
 * JSON.stringifies them for SQLite persistence.
 *
 * For the C++ buffer, we store pre-serialized JSON strings since the
 * BufferStore interface on the TS side handles the AnyMap -> JS
 * conversion. This keeps the C++ side simple and focused on
 * thread-safe buffering.
 */
struct NativeBufferEntry {
    std::string key;
    std::string valueJSON;
    NativeEntryType entryType;
    // replaceNullPatches stored as serialized JSON array string
    std::string replaceNullPatchesJSON;
};

class NativeBufferStore {
public:
    NativeBufferStore() = default;
    ~NativeBufferStore() = default;

    // Non-copyable, non-movable
    NativeBufferStore(const NativeBufferStore&) = delete;
    NativeBufferStore& operator=(const NativeBufferStore&) = delete;
    NativeBufferStore(NativeBufferStore&&) = delete;
    NativeBufferStore& operator=(NativeBufferStore&&) = delete;

    // -----------------------------------------------------------------------
    // BufferStore interface (called from JS main thread via JSI)
    // -----------------------------------------------------------------------

    /**
     * Get a buffer entry by key, or nullptr if not found.
     * Thread-safe: acquires shared_lock (allows concurrent readers).
     */
    const NativeBufferEntry* get(const std::string& key);

    /**
     * Insert or replace a buffer entry.
     * Thread-safe: acquires unique_lock (exclusive access).
     */
    void set(const std::string& key, NativeBufferEntry entry);

    /**
     * Delete a key from the buffer.
     * Thread-safe: acquires unique_lock.
     */
    bool erase(const std::string& key);

    /**
     * Check if a key exists in the buffer.
     * Thread-safe: acquires shared_lock.
     */
    bool has(const std::string& key);

    /**
     * Get the number of pending entries.
     * Thread-safe: acquires shared_lock.
     */
    size_t size();

    /**
     * Clear all pending entries.
     * Thread-safe: acquires unique_lock.
     */
    void clear();

    /**
     * Get a snapshot of all entries (for the TS side to iterate).
     * Thread-safe: acquires shared_lock.
     */
    std::vector<std::pair<std::string, NativeBufferEntry>> entries();

    // -----------------------------------------------------------------------
    // Drain (called from Worklet Worker Runtime)
    // -----------------------------------------------------------------------

    /**
     * Atomically drain all pending entries from the buffer.
     *
     * Returns all entries and clears the buffer in a single atomic operation.
     * The lock is held only for the duration of a swap -- microseconds.
     * The caller (Worklet Worker Runtime) gets sole ownership of the
     * returned data and can take its time serializing and persisting.
     *
     * Thread-safe: acquires unique_lock.
     */
    std::vector<std::pair<std::string, NativeBufferEntry>> drain();

private:
    mutable std::shared_mutex mutex_;
    std::unordered_map<std::string, NativeBufferEntry> buffer_;
};

} // namespace onyx
