cmake_minimum_required(VERSION 3.16)
project(OnyxNativeBufferStore LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# NativeBufferStore (C++ -- thread-safe buffer HybridObject)
# ---------------------------------------------------------------------------
# Pure buffer with std::shared_mutex. No SQLite, no background thread.
# The Worklet Worker Runtime handles persistence via react-native-nitro-sqlite.
add_library(onyx_native_buffer_store STATIC NativeBufferStore.cpp)
target_include_directories(onyx_native_buffer_store PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

# ---------------------------------------------------------------------------
# Test harness
# ---------------------------------------------------------------------------
if(BUILD_TESTING)
    add_executable(native_buffer_store_test test_native_buffer_store.cpp)
    target_link_libraries(native_buffer_store_test PRIVATE onyx_native_buffer_store)
endif()
