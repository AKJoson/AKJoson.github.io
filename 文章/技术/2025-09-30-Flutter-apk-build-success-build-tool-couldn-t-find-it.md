---
title: "Flutter apk build success, build tool couldn't find it"
date: "2025-09-30"
category: "技术"
tags: ["Flutter", "Android"]
summary: "解决 Flutter 已生成 APK 却无法找到产物的问题，记录 Gradle flavor 配置与构建方式。"
permalink: "/2025/09/30/Flutter-apk-build-success-build-tool-couldn-t-find-it/"
---

<a id="When-compiling-an-Android-APK-in-a-Flutter-project-it-prompts-that-the-compiled-APK-cannot-be-found"></a>

#### When compiling an Android APK in a Flutter project, it prompts that the compiled APK cannot be found.



```java
Error: Gradle build failed to produce an .apk file. It's likely that this file was generated under /Users/pengyin/Downloads/program/company/hilife/hilife3inone-flutter/build, but the tool couldn't find it.
```

 

<a id="In-android-build-gradle-you-can-see-the-‘product-staging’-flavor"></a>

#### In android/build.gradle, you can see the ‘product&staging’ flavor



```text
productFlavors {
    product {
        dimension "app"
        buildConfigField("boolean", "LOG_WRITE_DISABLE", "true")
        ndk {
            abiFilters 'armeabi-v7a', 'arm64-v8a'
        }
    }

    staging {
        dimension "app"
        buildConfigField("boolean", "LOG_WRITE_DISABLE", "false")
        ndk {
            abiFilters 'armeabi-v7a', 'arm64-v8a'
        }
    }
```

 

<a id="Solution"></a>

#### Solution:



![Image text](</images/flutter_build_apk_error.png>)
