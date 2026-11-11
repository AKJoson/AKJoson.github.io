// examples/IMyService.aidl
package com.example.binderdemo;

import com.example.binderdemo.ICallback;

/**
 * 一个最小但覆盖主要场景的 Binder 接口：
 *   - 同步方法（有返回值）
 *   - oneway 方法（无返回值，不阻塞）
 *   - Binder 对象作为参数（回调）
 */
interface IMyService {

    /** 同步方法：客户端阻塞等待返回值 */
    String echo(String s);

    /**
     * oneway：客户端不等待，立刻返回。
     * 注意 AIDL 规则：oneway 方法不能有返回值，也不能声明 throws。
     */
    oneway void log(String tag, String msg);

    /** 注册回调：cb 会被序列化成 flat_binder_object 传给服务端 */
    void registerCallback(ICallback cb);

    /** 反注册：不调用会泄漏 */
    void unregisterCallback(ICallback cb);
}
