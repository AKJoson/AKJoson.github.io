# examples —— 一个最小的 Binder 服务，从 AIDL 到调用

这个目录用一个最简单但完整的例子（`echo`），把 `03-RPC原理.md` 和 `05-完整消息流转.md` 里的概念落到代码上。

## 文件

| 文件 | 说明 |
|------|------|
| `IMyService.aidl` | 接口定义（唯一需要你手写的部分） |
| `IMyService.java` | **`aidl` 编译器生成的代码**（这里加了很多注释，逐行对应 `03-RPC原理.md` 的第 4 节） |
| `MyServiceImpl.java` | 服务端实现 |
| `MyServiceBinderService.java` | 一个 `Service`，把实现暴露出去 |
| `ClientSide.java` | 客户端连接与调用 |
| `native/IMyService.h` | C++ 侧的等价物（`BnMyService` / `BpMyService`） |
| `native/IMyService.cpp` | C++ 侧实现 |
| `build/Android.bp` | Soong 构建脚本示例 |

---

## 1. `IMyService.aidl`

```aidl
// examples/IMyService.aidl
package com.example.binderdemo;

import com.example.binderdemo.ICallback;

interface IMyService {

    /** 同步方法：有返回值 */
    String echo(String s);

    /** oneway 方法：无返回值、不阻塞（AIDL 里加 oneway 关键字） */
    oneway void log(String tag, String msg);

    /** 传入一个回调 Binder 对象（演示"回调/反向 RPC"） */
    void registerCallback(ICallback cb);

    void unregisterCallback(ICallback cb);
}
```

```aidl
// examples/ICallback.aidl
package com.example.binderdemo;

oneway interface ICallback {
    void onEvent(String msg);
}
```

---

## 2. 生成的 `IMyService.java`（带注释）

见同目录的 `IMyService.java`。**重点看这四处**：

1. `asInterface()` —— 同进程走本地对象，跨进程才包 `Proxy`。
2. `Proxy.echo()` —— 序列化参数 → `transact` → 反序列化结果。
3. `Stub.onTransact()` —— `enforceInterface` → 反序列化 → 调真实实现 → 序列化结果。
4. `TRANSACTION_echo` 常量 —— 就是 `binder_transaction_data.code`。

---

## 3. 服务端实现

```java
// examples/MyServiceImpl.java
package com.example.binderdemo;

import android.os.RemoteCallbackList;
import android.os.RemoteException;
import android.util.Log;

public class MyServiceImpl extends IMyService.Stub {

    private static final String TAG = "MyServiceImpl";

    // RemoteCallbackList 是专门为 Binder 回调设计的容器：
    //   - 线程安全
    //   - 自动处理 linkToDeath，客户端进程死亡时自动移除
    private final RemoteCallbackList<ICallback> mCallbacks = new RemoteCallbackList<>();

    @Override
    public String echo(String s) {
        // ★ 这里可以拿到调用方身份（内核填充，无法伪造）
        Log.d(TAG, "echo() called by pid=" + android.os.Binder.getCallingPid()
                + " uid=" + android.os.Binder.getCallingUid());

        // 业务逻辑
        return "echo: " + s;
    }

    @Override
    public void log(String tag, String msg) {
        // oneway 方法：没有返回值，也不会抛 RemoteException
        Log.i(TAG, "[" + tag + "] " + msg);
    }

    @Override
    public void registerCallback(ICallback cb) {
        if (cb != null) mCallbacks.register(cb);
    }

    @Override
    public void unregisterCallback(ICallback cb) {
        if (cb != null) mCallbacks.unregister(cb);
    }

    /** 广播给所有已注册的回调（演示反向调用） */
    public void broadcast(String msg) {
        int n = mCallbacks.beginBroadcast();
        try {
            for (int i = 0; i < n; i++) {
                try {
                    mCallbacks.getBroadcastItem(i).onEvent(msg);
                } catch (RemoteException e) {
                    // 客户端挂了，RemoteCallbackList 会自动清理
                    Log.w(TAG, "callback dead", e);
                }
            }
        } finally {
            mCallbacks.finishBroadcast();
        }
    }
}
```

> **注意 `RemoteCallbackList`**：它内部为每个回调注册了 `DeathRecipient`，客户端进程死亡时自动 `unregister`。手写 `List<ICallback>` 是 Binder 泄漏最常见的原因。

---

## 4. 暴露为 Service

```java
// examples/MyServiceBinderService.java
package com.example.binderdemo;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public class MyServiceBinderService extends Service {

    private MyServiceImpl mImpl;

    @Override
    public void onCreate() {
        super.onCreate();
        mImpl = new MyServiceImpl();
    }

    @Override
    public IBinder onBind(Intent intent) {
        // ★ 返回的 IBinder 就是客户端的 mRemote。
        //   同进程时它是 MyServiceImpl 自己（本地对象）；
        //   跨进程时内核会把它封装成 BinderProxy 交给客户端。
        return mImpl;
    }
}
```

---

## 5. 客户端

```java
// examples/ClientSide.java
package com.example.binderdemo;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

public class ClientSide {

    private static final String TAG = "ClientSide";

    private IMyService mService;

    private final ICallback mCallback = new ICallback.Stub() {
        @Override
        public void onEvent(String msg) {
            // ★ 这个方法在一个 Binder 线程里被调用，不是主线程！
            Log.d(TAG, "onEvent: " + msg);
        }
    };

    private final ServiceConnection mConn = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            // ★★★ 关键一行 ★★★
            // binder 是 BinderProxy（跨进程）或 MyServiceImpl（同进程）。
            // asInterface 会自动判断：
            //   - 同进程 → queryLocalInterface 返回 MyServiceImpl，直接用它
            //   - 跨进程 → 包成 IMyService.Stub.Proxy，后续调用走 IPC
            mService = IMyService.Stub.asInterface(binder);

            // 监听服务死亡
            try {
                binder.linkToDeath(mDeathRecipient, 0);
            } catch (RemoteException e) {
                Log.w(TAG, "service already dead");
            }

            try {
                String r = mService.echo("hello");
                Log.d(TAG, "echo returned: " + r);      // "echo: hello"

                mService.log("demo", "a oneway call");  // 立刻返回，不等结果

                mService.registerCallback(mCallback);   // 把回调对象传过去
            } catch (RemoteException e) {
                Log.e(TAG, "call failed", e);
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            // 注意：这只是"连接断开"，不代表服务进程死了。
            // 真正的进程死亡要靠 linkToDeath。
            mService = null;
        }
    };

    private final IBinder.DeathRecipient mDeathRecipient = () -> {
        Log.w(TAG, "service process died!");   // ★ 在 Binder 线程里回调
        // 在这里做清理 / 重连
    };

    public void bind(Context ctx) {
        Intent intent = new Intent(ctx, MyServiceBinderService.class);
        ctx.bindService(intent, mConn, Context.BIND_AUTO_CREATE);
    }

    public void unbind(Context ctx) {
        if (mService != null) {
            try {
                // ★ 一定要注销回调，否则服务端会一直持有你的 Binder 对象 → 泄漏
                mService.unregisterCallback(mCallback);
            } catch (RemoteException ignored) {
            }
            mService = null;
        }
        ctx.unbindService(mConn);
    }
}
```

---

## 6. 跨进程版本（`android:process`）

同一个 app 里也能构造出跨进程场景，把 Service 放到独立进程即可：

```xml
<!-- AndroidManifest.xml -->
<service
    android:name=".MyServiceBinderService"
    android:process=":remote" />       <!-- ★ 关键：独立进程 -->
```

这样 `onServiceConnected` 拿到的 `binder` 就是 `BinderProxy`（而不是 `MyServiceImpl`）。
**这是学习 Binder 最方便的实验方式**：同一份代码，改一行 manifest 就能对比「本地调用」和「跨进程调用」。

验证方法：

```java
// 在 onServiceConnected 里
Log.d(TAG, "is remote? " + (binder instanceof android.os.BinderProxy));
// 同进程 → false（是 MyServiceImpl）
// 跨进程 → true
```

---

## 7. 用 `adb` 验证

```bash
# 装好后启动 app，找到进程 pid
adb shell ps -A | grep binderdemo

# 看这个进程的 binder 状态（需要 root）
adb shell su -c 'cat /sys/kernel/debug/binder/proc/<pid>'

# 抓 Binder 事务
adb shell su -c 'cat /sys/kernel/debug/tracing/trace_pipe' &
# 然后在 app 里触发一次 echo 调用

# 看统计
adb shell dumpsys binder_calls_stats | head -50
```

---

## 8. 对照表：代码 ↔ 内核结构

| 代码里的东西 | 内核里的东西 | 章节 |
|--------------|--------------|------|
| `MyServiceImpl`（`extends IMyService.Stub`） | `binder_node`（ptr = JavaBBinder 地址） | `04` |
| `onServiceConnected` 里的 `binder` | `BinderProxy` → `BpBinder(mHandle)` | `03` |
| `mService.echo("hello")` 的 `_data` | `binder_transaction_data.data.ptr.buffer` | `02` |
| `TRANSACTION_echo` | `binder_transaction_data.code` | `02` |
| `mService.registerCallback(mCallback)` | 负载里的 `flat_binder_object` | `02` |
| `linkToDeath` | `binder_ref.death` | `06` |
| `onEvent()` 在哪个线程跑 | Binder 线程池里的某个线程 | `06` |
| `RemoteCallbackList` | 自动 `BC_REQUEST_DEATH_NOTIFICATION` | `06` |
