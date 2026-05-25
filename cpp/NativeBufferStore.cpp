/**
 * NativeBufferStore implementation.
 *
 * Pure thread-safe buffer -- no background thread, no SQLite.
 * Uses std::shared_mutex for reader-writer locking:
 * - shared_lock for reads (get, has, size, entries)
 * - unique_lock for writes (set, erase, clear, drain)
 */

#include "NativeBufferStore.h"

#include <utility>

namespace onyx {

const NativeBufferEntry* NativeBufferStore::get(const std::string& key) {
    std::shared_lock lock(mutex_);
    auto it = buffer_.find(key);
    if (it == buffer_.end()) {
        return nullptr;
    }
    return &it->second;
}

void NativeBufferStore::set(const std::string& key, NativeBufferEntry entry) {
    std::unique_lock lock(mutex_);
    buffer_[key] = std::move(entry);
}

bool NativeBufferStore::erase(const std::string& key) {
    std::unique_lock lock(mutex_);
    return buffer_.erase(key) > 0;
}

bool NativeBufferStore::has(const std::string& key) {
    std::shared_lock lock(mutex_);
    return buffer_.find(key) != buffer_.end();
}

size_t NativeBufferStore::size() {
    std::shared_lock lock(mutex_);
    return buffer_.size();
}

void NativeBufferStore::clear() {
    std::unique_lock lock(mutex_);
    buffer_.clear();
}

std::vector<std::pair<std::string, NativeBufferEntry>> NativeBufferStore::entries() {
    std::shared_lock lock(mutex_);
    std::vector<std::pair<std::string, NativeBufferEntry>> result;
    result.reserve(buffer_.size());
    for (const auto& [key, entry] : buffer_) {
        result.emplace_back(key, entry);
    }
    return result;
}

std::vector<std::pair<std::string, NativeBufferEntry>> NativeBufferStore::drain() {
    std::unique_lock lock(mutex_);

    // Move all entries out of the buffer atomically
    std::vector<std::pair<std::string, NativeBufferEntry>> result;
    result.reserve(buffer_.size());
    for (auto& [key, entry] : buffer_) {
        result.emplace_back(std::move(key), std::move(entry));
    }
    buffer_.clear();

    return result;
}

} // namespace onyx
