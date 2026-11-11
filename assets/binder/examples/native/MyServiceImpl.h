// examples/native/MyServiceImpl.h
//
// C++ 侧的服务实现，对应 Java 的 MyServiceImpl。
// 关键：继承 BnMyService，实现纯虚方法。

#pragma once

#include "IMyService.h"
#include <binder/IPCThreadState.h>
#include <binder/IServiceManager.h>
#include <utils/Log.h>

namespace com {
namespace example {
namespace binderdemo {

class MyServiceImpl : public BnMyService {
public:
    MyServiceImpl() = default;

    ::android::binder::Status echo(const ::std::string& s,
                                   ::std::string* _aidl_return) override {
        // ★ 拿调用方身份（内核填充的 sender_pid / sender_euid）
        pid_t callingPid = ::android::IPCThreadState::self()->getCallingPid();
        uid_t callingUid = ::android::IPCThreadState::self()->getCallingUid();
        ALOGD("echo() called by pid=%d uid=%d", callingPid, callingUid);

        *_aidl_return = "echo: " + s;
        return ::android::binder::Status::ok();
    }

    ::android::binder::Status log(const ::std::string& tag,
                                  const ::std::string& msg) override {
        ALOGI("[%s] %s", tag.c_str(), msg.c_str());
        return ::android::binder::Status::ok();
    }

    ::android::binder::Status registerCallback(
            const ::android::sp<::android::IBinder>& cb) override {
        // 生产代码里应该用 ::android::os::RemoteCallbackList
        // （它会自动为每个回调注册死亡通知）
        mCallbacks.push_back(cb);
        return ::android::binder::Status::ok();
    }

    ::android::binder::Status unregisterCallback(
            const ::android::sp<::android::IBinder>& cb) override {
        mCallbacks.erase(std::remove(mCallbacks.begin(), mCallbacks.end(), cb),
                         mCallbacks.end());
        return ::android::binder::Status::ok();
    }

private:
    std::vector<::android::sp<::android::IBinder>> mCallbacks;
};

// ───────────────────────────────────────────────────────────────────────────
// 把服务注册到 ServiceManager（对应 Java 的 addService）
// ───────────────────────────────────────────────────────────────────────────
inline void registerMyService() {
    ::android::sp<MyServiceImpl> service = new MyServiceImpl();

    // 内核会为 service 建一个 binder_node；
    // ServiceManager 进程会拿到一个指向它的 handle。
    ::android::status_t status =
            ::android::defaultServiceManager()->addService(
                    ::android::String16("com.example.binderdemo.IMyService"), service);

    ALOGI("addService status=%d", status);
}

// ───────────────────────────────────────────────────────────────────────────
// 服务端主循环（对应 Java 的 joinThreadPool）
// ───────────────────────────────────────────────────────────────────────────
inline void runBinderLoop() {
    // 设置线程池上限
    ::android::ProcessState::self()->setThreadPoolMaxThreadCount(4);
    // 启动线程池
    ::android::ProcessState::self()->startThreadPool();
    // 当前线程加入 Binder 循环（成为主 Binder 线程）
    ::android::IPCThreadState::self()->joinThreadPool();
}

}  // namespace binderdemo
}  // namespace example
}  // namespace com
