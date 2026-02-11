/**
 * Test harness for the simplified NativeBufferStore.
 *
 * Verifies the thread-safe buffer operations (set, get, erase, clear,
 * entries, drain) using std::shared_mutex. No SQLite or background thread.
 *
 * Run via:
 *   cd cpp/build && cmake .. -DBUILD_TESTING=ON && make && ./native_buffer_store_test
 */

#include "NativeBufferStore.h"

#include <cassert>
#include <iostream>
#include <thread>

using namespace onyx;

static void test_set_and_get() {
    std::cout << "test_set_and_get... ";
    NativeBufferStore store;

    store.set("key1", {"key1", R"("hello")", NativeEntryType::Set, ""});

    auto* entry = store.get("key1");
    assert(entry != nullptr);
    assert(entry->key == "key1");
    assert(entry->valueJSON == R"("hello")");
    assert(entry->entryType == NativeEntryType::Set);

    assert(store.has("key1"));
    assert(!store.has("nonexistent"));
    assert(store.size() == 1);

    std::cout << "PASS\n";
}

static void test_erase_and_clear() {
    std::cout << "test_erase_and_clear... ";
    NativeBufferStore store;

    store.set("k1", {"k1", R"(1)", NativeEntryType::Set, ""});
    store.set("k2", {"k2", R"(2)", NativeEntryType::Set, ""});
    store.set("k3", {"k3", R"(3)", NativeEntryType::Set, ""});

    assert(store.size() == 3);
    assert(store.erase("k2"));
    assert(store.size() == 2);
    assert(!store.has("k2"));

    store.clear();
    assert(store.size() == 0);

    std::cout << "PASS\n";
}

static void test_entries() {
    std::cout << "test_entries... ";
    NativeBufferStore store;

    store.set("a", {"a", R"("va")", NativeEntryType::Set, ""});
    store.set("b", {"b", R"("vb")", NativeEntryType::Merge, ""});

    auto ents = store.entries();
    assert(ents.size() == 2);

    std::cout << "PASS\n";
}

static void test_drain() {
    std::cout << "test_drain... ";
    NativeBufferStore store;

    store.set("d1", {"d1", R"("v1")", NativeEntryType::Set, ""});
    store.set("d2", {"d2", R"("v2")", NativeEntryType::Merge, ""});
    store.set("d3", {"d3", R"("v3")", NativeEntryType::Set, ""});

    assert(store.size() == 3);

    // Drain should return all entries and clear the buffer
    auto drained = store.drain();
    assert(drained.size() == 3);
    assert(store.size() == 0);

    // Verify the drained entries contain expected data
    bool found_d1 = false, found_d2 = false, found_d3 = false;
    for (const auto& [key, entry] : drained) {
        if (key == "d1") {
            assert(entry.valueJSON == R"("v1")");
            assert(entry.entryType == NativeEntryType::Set);
            found_d1 = true;
        } else if (key == "d2") {
            assert(entry.valueJSON == R"("v2")");
            assert(entry.entryType == NativeEntryType::Merge);
            found_d2 = true;
        } else if (key == "d3") {
            assert(entry.valueJSON == R"("v3")");
            assert(entry.entryType == NativeEntryType::Set);
            found_d3 = true;
        }
    }
    assert(found_d1 && found_d2 && found_d3);

    // Drain again should return empty
    auto drained2 = store.drain();
    assert(drained2.empty());

    std::cout << "PASS\n";
}

static void test_drain_during_writes() {
    std::cout << "test_drain_during_writes... ";
    NativeBufferStore store;

    // Add some entries, drain, then add more and drain again
    store.set("before1", {"before1", R"("b1")", NativeEntryType::Set, ""});
    store.set("before2", {"before2", R"("b2")", NativeEntryType::Set, ""});

    auto first_drain = store.drain();
    assert(first_drain.size() == 2);
    assert(store.size() == 0);

    // New entries after drain should be independent
    store.set("after1", {"after1", R"("a1")", NativeEntryType::Set, ""});

    auto second_drain = store.drain();
    assert(second_drain.size() == 1);
    assert(second_drain[0].first == "after1");
    assert(store.size() == 0);

    std::cout << "PASS\n";
}

static void test_concurrent_set_and_drain() {
    std::cout << "test_concurrent_set_and_drain... ";
    NativeBufferStore store;

    // Simulate the main thread writing while worker thread drains
    std::atomic<int> total_drained{0};
    std::atomic<bool> done_writing{false};

    // Writer thread (simulates main JS thread)
    std::thread writer([&store, &done_writing]() {
        for (int i = 0; i < 100; ++i) {
            std::string key = "key_" + std::to_string(i);
            std::string val = "\"value_" + std::to_string(i) + "\"";
            store.set(key, {key, val, NativeEntryType::Set, ""});
        }
        done_writing = true;
    });

    // Drainer thread (simulates Worklet Worker Runtime)
    std::thread drainer([&store, &total_drained, &done_writing]() {
        while (!done_writing || store.size() > 0) {
            auto drained = store.drain();
            total_drained += static_cast<int>(drained.size());
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    });

    writer.join();
    drainer.join();

    // All 100 entries should have been drained total
    assert(total_drained == 100);
    assert(store.size() == 0);

    std::cout << "PASS\n";
}

int main() {
    std::cout << "=== NativeBufferStore C++ Tests ===\n";

    test_set_and_get();
    test_erase_and_clear();
    test_entries();
    test_drain();
    test_drain_during_writes();
    test_concurrent_set_and_drain();

    std::cout << "\n=== All tests passed! ===\n";
    return 0;
}
