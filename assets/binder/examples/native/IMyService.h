// examples/native/IMyService.h
//
// AIDL C++ 后端生成的代码结构（这里做了简化和注释化处理，
// 实际生成的代码会用 ::android::binder::Status、大量 AIDL_* 宏等）。
//
// 结构上和 Java 后端一一对应：
//   Java                          C++
//   ──────────────────────────    ──────────────────────────────
//   interface IMyService     ↔    class IMyService : IInterface
//   IMyService.Stub          ↔    class BnMyService : BnInterface<IMyService>
//   IMyService.Stub.Proxy    ↔    class BpMyService : BpInterface<IMyService>
//   Binder.execTransact      ↔    BnMyService::onTransact
//   BinderProxy.transact     ↔    BpMyService::xxx() 里的 remote()->transact()

#pragma once

#include <binder/IInterface.h>
#include <binder/Parcel.h>
#include <binder/Status.h>
#include <string>

namespace com {
namespace example {
namespace binderdemo {

// AIDL 的接口标识符，对应 Java 侧的 DESCRIPTOR
constexpr const char* kIMyServiceDescriptor = "com.example.binderdemo.IMyService";

class IMyService : public ::android::IInterface {
public:
    // 声明 asInterface() / asBinder() / getInterfaceDescriptor() 等样板方法
    DECLARE_META_INTERFACE(IMyService)

    // ★ 方法号 = binder_transaction_data.code
    enum TransactionCode : int32_t {
        ECHO               = ::android::IBinder::FIRST_CALL_TRANSACTION + 0,
        LOG                = ::android::IBinder::FIRST_CALL_TRANSACTION + 1,
        REGISTER_CALLBACK  = ::android::IBinder::FIRST_CALL_TRANSACTION + 2,
        UNREGISTER_CALLBACK= ::android::IBinder::FIRST_CALL_TRANSACTION + 3,
    };

    // ★ 对应 AIDL 里的 String echo(String s);
    //   返回值通过出参 _aidl_return 传，状态通过 Status 返回
    virtual ::android::binder::Status echo(const ::std::string& s,
                                           ::std::string* _aidl_return) = 0;

    // ★ 对应 oneway void log(String, String);
    //   现代 AIDL 生成的是 void + 内部标记 oneway
    virtual ::android::binder::Status log(const ::std::string& tag,
                                          const ::std::string& msg) = 0;

    virtual ::android::binder::Status registerCallback(
            const ::android::sp<::android::IBinder>& cb) = 0;

    virtual ::android::binder::Status unregisterCallback(
            const ::android::sp<::android::IBinder>& cb) = 0;
};

// ═══════════════════════════════════════════════════════════════════════════
// Bp 侧：客户端代理（对应 Java 的 Stub.Proxy）
// ═══════════════════════════════════════════════════════════════════════════
class BpMyService : public ::android::BpInterface<IMyService> {
public:
    explicit BpMyService(const ::android::sp<::android::IBinder>& impl)
        : ::android::BpInterface<IMyService>(impl) {}

    ::android::binder::Status echo(const ::std::string& s,
                                   ::std::string* _aidl_return) override {
        ::android::Parcel _aidl_data;
        ::android::Parcel _aidl_reply;

        // ① writeInterfaceToken：写接口标识（含接口 hash，用于版本校验）
        _aidl_data.writeInterfaceToken(getInterfaceDescriptor());
        // ② 序列化参数
        _aidl_data.writeUtf8AsUtf16(s);

        // ③ ★★ 发起 RPC
        ::android::status_t _aidl_ret_status =
                remote()->transact(IMyService::ECHO, _aidl_data, &_aidl_reply, 0);
        if (_aidl_ret_status != ::android::NO_ERROR) {
            return ::android::binder::Status::fromExceptionCode(
                    ::android::binder::Status::EX_TRANSACTION_FAILED);
        }

        // ④ 反序列化：先读状态，再读返回值
        ::android::binder::Status _aidl_status;
        _aidl_ret_status = _aidl_status.readFromParcel(_aidl_reply);
        if (_aidl_ret_status != ::android::NO_ERROR) {
            return ::android::binder::Status::fromStatusT(_aidl_ret_status);
        }
        if (!_aidl_status.isOk()) {
            return _aidl_status;
        }
        _aidl_ret_status = _aidl_reply.readUtf8FromUtf16(_aidl_return);
        if (_aidl_ret_status != ::android::NO_ERROR) {
            return ::android::binder::Status::fromStatusT(_aidl_ret_status);
        }

        return ::android::binder::Status::ok();
    }

    ::android::binder::Status log(const ::std::string& tag,
                                  const ::std::string& msg) override {
        ::android::Parcel _aidl_data;
        _aidl_data.writeInterfaceToken(getInterfaceDescriptor());
        _aidl_data.writeUtf8AsUtf16(tag);
        _aidl_data.writeUtf8AsUtf16(msg);

        // ★ oneway：reply 传 nullptr，flags 带 FLAG_ONEWAY
        ::android::status_t _aidl_ret_status =
                remote()->transact(IMyService::LOG, _aidl_data, nullptr,
                                   ::android::IBinder::FLAG_ONEWAY);
        if (_aidl_ret_status != ::android::NO_ERROR) {
            return ::android::binder::Status::fromStatusT(_aidl_ret_status);
        }
        return ::android::binder::Status::ok();
    }

    // registerCallback / unregisterCallback 省略，模式完全相同，
    // 只是参数用 _aidl_data.writeStrongBinder(cb)
};

// ═══════════════════════════════════════════════════════════════════════════
// Bn 侧：服务端骨架（对应 Java 的 Stub）
// ═══════════════════════════════════════════════════════════════════════════
class BnMyService : public ::android::BnInterface<IMyService> {
public:
    ::android::status_t onTransact(uint32_t _aidl_code,
                                   const ::android::Parcel& _aidl_data,
                                   ::android::Parcel* _aidl_reply,
                                   uint32_t _aidl_flags) override {
        // 校验接口标识
        ::android::status_t _aidl_ret_status =
                _aidl_data.checkInterface(this);
        if (_aidl_ret_status != ::android::NO_ERROR) return _aidl_ret_status;

        switch (_aidl_code) {
        case IMyService::ECHO: {
            ::std::string in_s;
            _aidl_data.readUtf8FromUtf16(&in_s);

            ::std::string _aidl_return;
            // ★ 调用真实实现（多态）
            ::android::binder::Status _aidl_status = echo(in_s, &_aidl_return);

            // 写状态 + 返回值
            _aidl_status.writeToParcel(_aidl_reply);
            if (!_aidl_status.isOk()) return ::android::OK;
            _aidl_reply->writeUtf8AsUtf16(_aidl_return);
            return ::android::OK;
        }
        case IMyService::LOG: {
            ::std::string in_tag, in_msg;
            _aidl_data.readUtf8FromUtf16(&in_tag);
            _aidl_data.readUtf8FromUtf16(&in_msg);

            ::android::binder::Status _aidl_status = log(in_tag, in_msg);
            // ★ oneway 没有 reply 缓冲区
            (void)_aidl_status;
            return ::android::OK;
        }
        default:
            return ::android::BBinder::onTransact(_aidl_code, _aidl_data, _aidl_reply, _aidl_flags);
        }
    }
};

}  // namespace binderdemo
}  // namespace example
}  // namespace com
