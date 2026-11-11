// examples/ICallback.aidl
package com.example.binderdemo;

/**
 * 回调接口。整个接口是 oneway 的 —— 因为回调通常不需要返回值，
 * 而且 oneway 可以避免"客户端调服务、服务端又回调客户端"形成的死锁环。
 */
oneway interface ICallback {
    void onEvent(String msg);
}
