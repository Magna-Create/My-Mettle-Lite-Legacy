// SPDX-License-Identifier: BSD-3-Clause
//
// Minimal JNI bridge for Qualcomm Genie. The bridge intentionally loads the
// licensed QAIRT libraries at runtime rather than linking or redistributing
// them with the source repository.

#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <dirent.h>
#include <sys/stat.h>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr const char* kLogTag = "MaisGenieX";
constexpr int32_t kGenieStatusSuccess = 0;
constexpr int32_t kSentenceComplete = 0;

using GenieStatus = int32_t;
using GenieHandle = void*;
using GenieSentenceCode = int32_t;
using GenieQueryCallback = void (*)(const char*, GenieSentenceCode, const void*);
using GenieAllocCallback = void (*)(size_t, const char**);

using DialogConfigCreateFromJsonFn = GenieStatus (*)(const char*, GenieHandle*);
using DialogConfigFreeFn = GenieStatus (*)(GenieHandle);
using DialogCreateFn = GenieStatus (*)(GenieHandle, GenieHandle*);
using DialogFreeFn = GenieStatus (*)(GenieHandle);
using DialogQueryFn = GenieStatus (*)(GenieHandle, const char*, GenieSentenceCode, GenieQueryCallback, const void*);
using DialogResetFn = GenieStatus (*)(GenieHandle);
using ProfileCreateFn = GenieStatus (*)(const char*, GenieHandle*);
using DialogConfigBindProfilerFn = GenieStatus (*)(GenieHandle, GenieHandle);
using ProfileGetJsonDataFn = GenieStatus (*)(GenieHandle, GenieAllocCallback, const char**);
using ProfileFreeFn = GenieStatus (*)(GenieHandle);

std::string ReadJString(JNIEnv* env, jstring value) {
    if (value == nullptr) return {};
    const char* raw = env->GetStringUTFChars(value, nullptr);
    if (raw == nullptr) throw std::runtime_error("Could not read a JNI string.");
    std::string result(raw);
    env->ReleaseStringUTFChars(value, raw);
    return result;
}

void ThrowRuntimeException(JNIEnv* env, const std::string& message) {
    jclass exceptionClass = env->FindClass("java/lang/RuntimeException");
    if (exceptionClass != nullptr) env->ThrowNew(exceptionClass, message.c_str());
}

bool IsRegularFile(const std::string& path) {
    struct stat info {};
    return stat(path.c_str(), &info) == 0 && S_ISREG(info.st_mode);
}

bool EndsWith(const std::string& value, const std::string& suffix) {
    return value.size() >= suffix.size() &&
           value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::vector<std::string> ListQnnLibraries(const std::string& directory) {
    std::vector<std::string> paths;
    DIR* handle = opendir(directory.c_str());
    if (handle == nullptr) return paths;

    while (dirent* entry = readdir(handle)) {
        const std::string name(entry->d_name);
        if (name == "." || name == ".." || name == "libGenie.so") continue;
        if (!EndsWith(name, ".so")) continue;
        if (name.rfind("libQnn", 0) != 0) continue;
        paths.push_back(directory + "/" + name);
    }
    closedir(handle);
    std::sort(paths.begin(), paths.end());
    return paths;
}

void* OpenLibrary(const std::string& path, int flags, bool required) {
    dlerror();
    void* handle = dlopen(path.c_str(), flags);
    if (handle == nullptr) {
        const char* error = dlerror();
        const std::string message = "Could not load " + path + ": " + (error == nullptr ? "unknown linker error" : error);
        if (required) throw std::runtime_error(message);
        __android_log_print(ANDROID_LOG_WARN, kLogTag, "%s", message.c_str());
    }
    return handle;
}

template <typename Function>
Function ResolveRequired(void* library, const char* name) {
    dlerror();
    void* raw = dlsym(library, name);
    const char* error = dlerror();
    if (raw == nullptr || error != nullptr) {
        throw std::runtime_error(std::string("libGenie.so is missing required symbol ") + name + ".");
    }
    return reinterpret_cast<Function>(raw);
}

template <typename Function>
Function ResolveOptional(void* library, const char* name) {
    dlerror();
    void* raw = dlsym(library, name);
    if (dlerror() != nullptr) return nullptr;
    return reinterpret_cast<Function>(raw);
}

void GenieAllocate(size_t size, const char** output) {
    if (output == nullptr) return;
    *output = static_cast<const char*>(std::malloc(size));
}

struct QueryCapture {
    std::mutex mutex;
    std::string output;
    std::chrono::steady_clock::time_point started;
    int64_t firstChunkMs = -1;
    GenieSentenceCode finalCode = kSentenceComplete;
};

void CaptureQueryOutput(const char* response, GenieSentenceCode sentenceCode, const void* userData) {
    if (response == nullptr || userData == nullptr) return;
    auto* capture = const_cast<QueryCapture*>(static_cast<const QueryCapture*>(userData));
    std::lock_guard<std::mutex> guard(capture->mutex);
    if (capture->firstChunkMs < 0 && response[0] != '\0') {
        capture->firstChunkMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - capture->started
        ).count();
    }
    capture->output.append(response);
    capture->finalCode = sentenceCode;
}

class GenieRuntime final {
  public:
    GenieRuntime(std::string arm64Directory, std::string dspDirectory, const std::string& configJson)
        : arm64Directory_(std::move(arm64Directory)), dspDirectory_(std::move(dspDirectory)) {
        if (arm64Directory_.empty()) throw std::runtime_error("QAIRT ARM64 library directory is missing.");
        if (configJson.empty()) throw std::runtime_error("Genie configuration JSON is empty.");

        setenv("ADSP_LIBRARY_PATH", dspDirectory_.c_str(), 1);
        setenv("LD_LIBRARY_PATH", arm64Directory_.c_str(), 1);

        for (const std::string& path : ListQnnLibraries(arm64Directory_)) {
            if (void* handle = OpenLibrary(path, RTLD_NOW | RTLD_GLOBAL, false)) preloadHandles_.push_back(handle);
        }

        const std::string geniePath = arm64Directory_ + "/libGenie.so";
        if (!IsRegularFile(geniePath)) throw std::runtime_error("libGenie.so is not installed in the imported QAIRT runtime.");
        genieLibrary_ = OpenLibrary(geniePath, RTLD_NOW | RTLD_LOCAL, true);

        dialogConfigCreateFromJson_ = ResolveRequired<DialogConfigCreateFromJsonFn>(genieLibrary_, "GenieDialogConfig_createFromJson");
        dialogConfigFree_ = ResolveRequired<DialogConfigFreeFn>(genieLibrary_, "GenieDialogConfig_free");
        dialogCreate_ = ResolveRequired<DialogCreateFn>(genieLibrary_, "GenieDialog_create");
        dialogFree_ = ResolveRequired<DialogFreeFn>(genieLibrary_, "GenieDialog_free");
        dialogQuery_ = ResolveRequired<DialogQueryFn>(genieLibrary_, "GenieDialog_query");
        dialogReset_ = ResolveRequired<DialogResetFn>(genieLibrary_, "GenieDialog_reset");

        profileCreate_ = ResolveOptional<ProfileCreateFn>(genieLibrary_, "GenieProfile_create");
        dialogConfigBindProfiler_ = ResolveOptional<DialogConfigBindProfilerFn>(genieLibrary_, "GenieDialogConfig_bindProfiler");
        profileGetJsonData_ = ResolveOptional<ProfileGetJsonDataFn>(genieLibrary_, "GenieProfile_getJsonData");
        profileFree_ = ResolveOptional<ProfileFreeFn>(genieLibrary_, "GenieProfile_free");

        RequireSuccess(dialogConfigCreateFromJson_(configJson.c_str(), &configHandle_), "create Genie dialog configuration");

        if (profileCreate_ != nullptr && dialogConfigBindProfiler_ != nullptr &&
            profileGetJsonData_ != nullptr && profileFree_ != nullptr) {
            RequireSuccess(profileCreate_(nullptr, &profileHandle_), "create Genie profiler");
            RequireSuccess(dialogConfigBindProfiler_(configHandle_, profileHandle_), "bind Genie profiler");
        }

        RequireSuccess(dialogCreate_(configHandle_, &dialogHandle_), "create Genie dialog");
    }

    GenieRuntime(const GenieRuntime&) = delete;
    GenieRuntime& operator=(const GenieRuntime&) = delete;

    ~GenieRuntime() {
        CloseNoThrow();
    }

    std::string Query(const std::string& prompt) {
        if (prompt.empty()) throw std::runtime_error("Qwen prompt is empty.");
        std::lock_guard<std::mutex> queryGuard(queryMutex_);
        if (dialogHandle_ == nullptr) throw std::runtime_error("Genie dialog is not loaded.");

        QueryCapture capture;
        capture.started = std::chrono::steady_clock::now();
        const auto queryStarted = capture.started;
        const GenieStatus status = dialogQuery_(
            dialogHandle_, prompt.c_str(), kSentenceComplete, CaptureQueryOutput, &capture
        );
        const auto queryFinished = std::chrono::steady_clock::now();
        RequireSuccess(status, "query Genie dialog");

        {
            std::lock_guard<std::mutex> captureGuard(capture.mutex);
            lastOutput_ = capture.output;
            lastFirstChunkMs_ = capture.firstChunkMs;
            lastSentenceCode_ = capture.finalCode;
        }
        lastQueryMs_ = std::chrono::duration_cast<std::chrono::milliseconds>(queryFinished - queryStarted).count();
        lastProfileJson_ = ReadProfileJson();
        return lastOutput_;
    }

    void Reset() {
        std::lock_guard<std::mutex> queryGuard(queryMutex_);
        if (dialogHandle_ == nullptr) throw std::runtime_error("Genie dialog is not loaded.");
        RequireSuccess(dialogReset_(dialogHandle_), "reset Genie dialog");
    }

    int64_t LastFirstChunkMs() const { return lastFirstChunkMs_; }
    int64_t LastQueryMs() const { return lastQueryMs_; }
    int32_t LastSentenceCode() const { return lastSentenceCode_; }
    const std::string& LastProfileJson() const { return lastProfileJson_; }

  private:
    void RequireSuccess(GenieStatus status, const char* operation) const {
        if (status != kGenieStatusSuccess) {
            throw std::runtime_error(std::string("Failed to ") + operation + " (Genie status " + std::to_string(status) + ").");
        }
    }

    std::string ReadProfileJson() const {
        if (profileHandle_ == nullptr || profileGetJsonData_ == nullptr) return {};
        const char* raw = nullptr;
        const GenieStatus status = profileGetJsonData_(profileHandle_, GenieAllocate, &raw);
        if (status != kGenieStatusSuccess || raw == nullptr) return {};
        std::string result(raw);
        std::free(const_cast<char*>(raw));
        return result;
    }

    void CloseNoThrow() noexcept {
        if (dialogHandle_ != nullptr && dialogFree_ != nullptr) {
            dialogFree_(dialogHandle_);
            dialogHandle_ = nullptr;
        }
        if (configHandle_ != nullptr && dialogConfigFree_ != nullptr) {
            dialogConfigFree_(configHandle_);
            configHandle_ = nullptr;
        }
        if (profileHandle_ != nullptr && profileFree_ != nullptr) {
            profileFree_(profileHandle_);
            profileHandle_ = nullptr;
        }
        if (genieLibrary_ != nullptr) {
            dlclose(genieLibrary_);
            genieLibrary_ = nullptr;
        }
        for (auto iterator = preloadHandles_.rbegin(); iterator != preloadHandles_.rend(); ++iterator) {
            if (*iterator != nullptr) dlclose(*iterator);
        }
        preloadHandles_.clear();
    }

    std::string arm64Directory_;
    std::string dspDirectory_;
    std::vector<void*> preloadHandles_;
    void* genieLibrary_ = nullptr;

    DialogConfigCreateFromJsonFn dialogConfigCreateFromJson_ = nullptr;
    DialogConfigFreeFn dialogConfigFree_ = nullptr;
    DialogCreateFn dialogCreate_ = nullptr;
    DialogFreeFn dialogFree_ = nullptr;
    DialogQueryFn dialogQuery_ = nullptr;
    DialogResetFn dialogReset_ = nullptr;
    ProfileCreateFn profileCreate_ = nullptr;
    DialogConfigBindProfilerFn dialogConfigBindProfiler_ = nullptr;
    ProfileGetJsonDataFn profileGetJsonData_ = nullptr;
    ProfileFreeFn profileFree_ = nullptr;

    GenieHandle configHandle_ = nullptr;
    GenieHandle dialogHandle_ = nullptr;
    GenieHandle profileHandle_ = nullptr;
    mutable std::mutex queryMutex_;
    std::string lastOutput_;
    std::string lastProfileJson_;
    int64_t lastFirstChunkMs_ = -1;
    int64_t lastQueryMs_ = -1;
    int32_t lastSentenceCode_ = kSentenceComplete;
};

GenieRuntime* RuntimeFromHandle(jlong handle) {
    if (handle == 0) throw std::runtime_error("Genie runtime handle is null.");
    return reinterpret_cast<GenieRuntime*>(handle);
}

}  // namespace

extern "C" JNIEXPORT jlong JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeCreate(
    JNIEnv* env,
    jclass,
    jstring arm64Directory,
    jstring dspDirectory,
    jstring configJson
) {
    try {
        auto* runtime = new GenieRuntime(
            ReadJString(env, arm64Directory),
            ReadJString(env, dspDirectory),
            ReadJString(env, configJson)
        );
        return reinterpret_cast<jlong>(runtime);
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
        return 0;
    }
}

extern "C" JNIEXPORT jstring JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeQuery(
    JNIEnv* env,
    jclass,
    jlong handle,
    jstring prompt
) {
    try {
        const std::string output = RuntimeFromHandle(handle)->Query(ReadJString(env, prompt));
        return env->NewStringUTF(output.c_str());
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeReset(JNIEnv* env, jclass, jlong handle) {
    try {
        RuntimeFromHandle(handle)->Reset();
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
    }
}

extern "C" JNIEXPORT jlong JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeGetLastFirstChunkMs(JNIEnv* env, jclass, jlong handle) {
    try {
        return RuntimeFromHandle(handle)->LastFirstChunkMs();
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
        return -1;
    }
}

extern "C" JNIEXPORT jlong JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeGetLastQueryMs(JNIEnv* env, jclass, jlong handle) {
    try {
        return RuntimeFromHandle(handle)->LastQueryMs();
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
        return -1;
    }
}

extern "C" JNIEXPORT jint JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeGetLastSentenceCode(JNIEnv* env, jclass, jlong handle) {
    try {
        return RuntimeFromHandle(handle)->LastSentenceCode();
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
        return -1;
    }
}

extern "C" JNIEXPORT jstring JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeGetLastProfileJson(JNIEnv* env, jclass, jlong handle) {
    try {
        return env->NewStringUTF(RuntimeFromHandle(handle)->LastProfileJson().c_str());
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_dev_kian_gymapp_MaisGenieXNative_nativeFree(JNIEnv* env, jclass, jlong handle) {
    try {
        delete RuntimeFromHandle(handle);
    } catch (const std::exception& error) {
        ThrowRuntimeException(env, error.what());
    }
}
