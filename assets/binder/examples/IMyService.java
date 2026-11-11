/*
 * examples/IMyService.java
 *
 * 这是 `aidl` 编译器为 IMyService.aidl 生成的代码（Java 后端），
 * 这里加上了大量注释，把它和 Binder 内核机制一一对应起来。
 *
 * 生成命令（AOSP 环境下）：
 *   aidl --lang=java -o out -I src src/com/example/binderdemo/IMyService.aidl
 *
 * 阅读重点：
 *   ① asInterface()   —— 同进程/跨进程的分流
 *   ② Proxy.echo()    —— 序列化 + transact + 反序列化
 *   ③ Stub.onTransact —— 反序列化 + 调实现 + 序列化
 *   ④ TRANSACTION_*   —— 就是 binder_transaction_data.code
 */

package com.example.binderdemo;

public interface IMyService extends android.os.IInterface {

    /** 接口标识符。会被写进 Parcel（writeInterfaceToken），用于校验接口版本。 */
    public static final java.lang.String DESCRIPTOR = "com.example.binderdemo.IMyService";

    // 方法号：对应 binder_transaction_data.code
    static final int TRANSACTION_echo               = android.os.IBinder.FIRST_CALL_TRANSACTION + 0; // = 1
    static final int TRANSACTION_log                = android.os.IBinder.FIRST_CALL_TRANSACTION + 1; // = 2
    static final int TRANSACTION_registerCallback   = android.os.IBinder.FIRST_CALL_TRANSACTION + 2; // = 3
    static final int TRANSACTION_unregisterCallback = android.os.IBinder.FIRST_CALL_TRANSACTION + 3; // = 4

    public java.lang.String echo(java.lang.String s) throws android.os.RemoteException;
    public void log(java.lang.String tag, java.lang.String msg) throws android.os.RemoteException;
    public void registerCallback(com.example.binderdemo.ICallback cb) throws android.os.RemoteException;
    public void unregisterCallback(com.example.binderdemo.ICallback cb) throws android.os.RemoteException;

    // ═══════════════════════════════════════════════════════════════════════
    // Stub：服务端骨架
    //   继承 android.os.Binder —— 所以它【就是】一个本地 Binder 对象
    //   对应内核里的 binder_node
    // ═══════════════════════════════════════════════════════════════════════
    public static abstract class Stub extends android.os.Binder implements com.example.binderdemo.IMyService {

        public Stub() {
            // 把 "自己" 和 DESCRIPTOR 绑定起来。
            // 之后 queryLocalInterface(DESCRIPTOR) 就能返回 this —— 这是同进程优化的基础。
            this.attachInterface(this, DESCRIPTOR);
        }

        /**
         * ★ asInterface：IBinder → 接口对象
         * 这是「跨进程调用看起来像本地调用」的入口。
         */
        public static com.example.binderdemo.IMyService asInterface(android.os.IBinder obj) {
            if ((obj == null)) {
                return null;
            }
            // ① 先问：你是不是本地对象？
            //    - obj 是 Binder（本地）→ 如果 DESCRIPTOR 匹配，返回真实实现
            //    - obj 是 BinderProxy（远程）→ 永远返回 null
            android.os.IInterface iin = obj.queryLocalInterface(DESCRIPTOR);
            if (((iin != null) && (iin instanceof com.example.binderdemo.IMyService))) {
                // ★ 同进程快路径：直接返回真实对象，后续调用不经过 IPC
                return ((com.example.binderdemo.IMyService) iin);
            }
            // ② 跨进程：包一层 Proxy
            return new com.example.binderdemo.IMyService.Stub.Proxy(obj);
        }

        @Override
        public android.os.IBinder asBinder() {
            return this;
        }

        /**
         * ★ onTransact：服务端总入口
         * 被 JavaBBinder::onTransact（JNI）调用，参数直接来自内核写好的缓冲区。
         */
        @Override
        public boolean onTransact(int code, android.os.Parcel data,
                                  android.os.Parcel reply, int flags)
                throws android.os.RemoteException {
            java.lang.String descriptor = DESCRIPTOR;
            switch (code) {

                // 保留 code：查询接口描述符（内核/框架用来探测接口）
                case INTERFACE_TRANSACTION: {
                    reply.writeString(descriptor);
                    return true;
                }

                // 保留 code：dumpsys 走这里
                case DUMP_TRANSACTION: {
                    // ... 生成 AIDL 时如果接口有 dump 相关注解会生成
                    break;
                }

                case TRANSACTION_echo: {
                    // ① 校验接口（防止客户端用旧版接口调用）
                    data.enforceInterface(descriptor);
                    // ② 反序列化参数（顺序必须与写入一致）
                    java.lang.String _arg0;
                    _arg0 = data.readString();
                    // ③ 调用真实实现
                    java.lang.String _result = this.echo(_arg0);
                    // ④ 序列化结果：先写"无异常"标志，再写返回值
                    reply.writeNoException();
                    reply.writeString(_result);
                    return true;
                }

                case TRANSACTION_log: {
                    data.enforceInterface(descriptor);
                    java.lang.String _arg0 = data.readString();
                    java.lang.String _arg1 = data.readString();
                    this.log(_arg0, _arg1);
                    // ★ oneway 方法：不写 reply（因为根本没有 reply 缓冲区）
                    return true;
                }

                case TRANSACTION_registerCallback: {
                    data.enforceInterface(descriptor);
                    com.example.binderdemo.ICallback _arg0;
                    // ★ readStrongBinder 读出的 flat_binder_object 已被内核翻译成 handle
                    _arg0 = com.example.binderdemo.ICallback.Stub.asInterface(data.readStrongBinder());
                    this.registerCallback(_arg0);
                    reply.writeNoException();
                    return true;
                }

                case TRANSACTION_unregisterCallback: {
                    data.enforceInterface(descriptor);
                    com.example.binderdemo.ICallback _arg0;
                    _arg0 = com.example.binderdemo.ICallback.Stub.asInterface(data.readStrongBinder());
                    this.unregisterCallback(_arg0);
                    reply.writeNoException();
                    return true;
                }

                default:
                    return super.onTransact(code, data, reply, flags);
            }
            return true;
        }

        // ═══════════════════════════════════════════════════════════════════
        // Proxy：客户端代理
        //   mRemote 是 BinderProxy（跨进程）—— 对应内核里的 binder_ref(handle)
        // ═══════════════════════════════════════════════════════════════════
        private static class Proxy implements com.example.binderdemo.IMyService {

            private android.os.IBinder mRemote;

            Proxy(android.os.IBinder remote) {
                mRemote = remote;
            }

            @Override
            public android.os.IBinder asBinder() {
                return mRemote;
            }

            public java.lang.String getInterfaceDescriptor() {
                return DESCRIPTOR;
            }

            /**
             * ★ 一次同步跨进程调用的完整模板
             */
            @Override
            public java.lang.String echo(java.lang.String s) throws android.os.RemoteException {
                // ① 拿两个 Parcel（从池子里取，避免频繁分配）
                android.os.Parcel _data  = android.os.Parcel.obtain();
                android.os.Parcel _reply = android.os.Parcel.obtain();
                java.lang.String _result;
                try {
                    // ② 写接口标识 + 参数
                    _data.writeInterfaceToken(DESCRIPTOR);
                    _data.writeString(s);

                    // ③ ★★ 真正发起 RPC：code=1, flags=0（同步）
                    //    这一行最终会走到 ioctl(BINDER_WRITE_READ)
                    boolean _status = mRemote.transact(Stub.TRANSACTION_echo, _data, _reply, 0);
                    // _status == false 表示事务没发出去（例如对端已死）
                    if (!_status) {
                        throw new android.os.RemoteException("transaction failed");
                    }

                    // ④ 读"有没有异常"，再读返回值
                    _reply.readException();
                    _result = _reply.readString();
                } finally {
                    _reply.recycle();
                    _data.recycle();
                }
                return _result;
            }

            /** oneway：flags = FLAG_ONEWAY，reply 传 null */
            @Override
            public void log(java.lang.String tag, java.lang.String msg) throws android.os.RemoteException {
                android.os.Parcel _data = android.os.Parcel.obtain();
                try {
                    _data.writeInterfaceToken(DESCRIPTOR);
                    _data.writeString(tag);
                    _data.writeString(msg);
                    // ★ flags = FLAG_ONEWAY，reply = null
                    boolean _status = mRemote.transact(Stub.TRANSACTION_log, _data, null,
                            android.os.IBinder.FLAG_ONEWAY);
                    if (!_status) {
                        throw new android.os.RemoteException("transaction failed");
                    }
                } finally {
                    _data.recycle();
                }
            }

            @Override
            public void registerCallback(com.example.binderdemo.ICallback cb) throws android.os.RemoteException {
                android.os.Parcel _data  = android.os.Parcel.obtain();
                android.os.Parcel _reply = android.os.Parcel.obtain();
                try {
                    _data.writeInterfaceToken(DESCRIPTOR);
                    // ★ 把 Binder 对象写进负载：会产生一个 flat_binder_object
                    //   内核会把它翻译成对端进程的 handle
                    _data.writeStrongBinder((((cb != null)) ? (cb.asBinder()) : (null)));
                    boolean _status = mRemote.transact(Stub.TRANSACTION_registerCallback, _data, _reply, 0);
                    if (!_status) {
                        throw new android.os.RemoteException("transaction failed");
                    }
                    _reply.readException();
                } finally {
                    _reply.recycle();
                    _data.recycle();
                }
            }

            @Override
            public void unregisterCallback(com.example.binderdemo.ICallback cb) throws android.os.RemoteException {
                android.os.Parcel _data  = android.os.Parcel.obtain();
                android.os.Parcel _reply = android.os.Parcel.obtain();
                try {
                    _data.writeInterfaceToken(DESCRIPTOR);
                    _data.writeStrongBinder((((cb != null)) ? (cb.asBinder()) : (null)));
                    boolean _status = mRemote.transact(Stub.TRANSACTION_unregisterCallback, _data, _reply, 0);
                    if (!_status) {
                        throw new android.os.RemoteException("transaction failed");
                    }
                    _reply.readException();
                } finally {
                    _reply.recycle();
                    _data.recycle();
                }
            }
        }
    }
}
