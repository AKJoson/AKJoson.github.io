# CherryBLOG

**写代码，也写生活。** 技术笔记与日常随想。

博客：<https://akjoson.github.io> · 仓库：<https://github.com/AKJoson/AKJoson.github.io>

当前目录就是博客的写作和发布项目。只需要 **Node.js 20 或更新版本**；Markdown 解析器已随项目保存，**不需要 npm install**。

## 平时怎么写

在当前目录打开终端，新建一篇草稿：

```sh
npm run new -- 技术 "我的技术笔记"
# 或者
npm run new -- 日常随想 "十月的小事"
```

文件会出现在 `草稿/技术/` 或 `草稿/日常随想/`。用你习惯的编辑器写 Markdown 即可。
也可以复制根目录的 `写作模板.md`，自己新建文章。

文章开头的格式：

```yaml
---
title: "我的技术笔记"
date: "2026-10-02"
category: "技术"
tags: ["Android", "源码阅读"]
summary: "用一两句话介绍文章，显示在首页和分类列表中。"
---

## 正文标题

从这里开始写。
```

分类只使用 `技术` 和 `日常随想`；日期使用 `YYYY-MM-DD`。元信息每行一个字段，字符串用双引号，标签用 JSON 数组。不支持 YAML 多行块、对象或嵌套结构。

图片放在 `images/`，在文章里写 `![图片说明](/images/文件名.png)`。

## 在本地看效果

不启动服务器也可以预览：

```sh
npm run preview -- --drafts
```

用浏览器打开 `.preview-site/index.html`（Finder 中按 `Command+Shift+.` 显示隐藏文件夹）。首页、文章、分类、搜索和主题切换都可以直接查看。修改后再次运行上面的命令。

想要保存后自动构建：

```sh
npm run dev -- --drafts
```

然后打开 <http://127.0.0.1:4173>；保存文章后刷新浏览器。`Ctrl+C` 结束预览。
不加 `--drafts` 时只预览正式文章。预览文件始终写入 `.preview-site/`，不会混入正式网站。

## 发布到 GitHub

1. 写好后把 Markdown 文件从 `草稿/技术/` 移到 `文章/技术/`，或从 `草稿/日常随想/` 移到 `文章/日常随想/`。
2. 在当前目录运行：

```sh
npm run publish -- "发布：我的新文章"
```

该命令会依次构建网站、检查站内链接、提交项目内的改动、推送当前分支到 GitHub。GitHub Pages 完成部署后，新文章就会上线。默认分支沿用原仓库的 `master`，页面沿用仓库根目录的静态文件和 `.nojekyll`，不需要引入 Hexo 或额外的部署服务。

如果推送被拒绝，按 Git 提示先处理身份认证或远程更新，再重新运行发布命令；脚本不会强制推送。

也可以手动操作：

```sh
npm run build
npm run check
git add -A
git commit -m "更新博客"
git push origin master
```

`草稿/`、原来的 `FreeRTOS/` 和 `.preview-site/` 已被 Git 忽略，不会由发布命令上传。需要公开的文章放进 `文章/`。可选的 `draft: true` 只控制网站展示；若不想上传源文件，应保存在 `草稿/` 中。

## 文件在哪里

| 路径 | 用途 |
| --- | --- |
| `文章/技术/*.md` | 正式技术文章 |
| `文章/日常随想/*.md` | 正式日常随想 |
| `草稿/` | 仅在本机保存的草稿 |
| `images/` | 文章图片 |
| `site.config.json` | 作者、站点地址、简介和座右铭 |
| `theme/` | 页面公共片段 |
| `assets/theme.css` | 主题样式 |
| `assets/theme.js` | 搜索、主题切换和代码复制 |
| `tooling/` | 离线构建与发布工具 |
| `index.html`、`2025/`、`archives/` 等 | 自动生成的网站，日常不需要手工编辑 |

新文章链接由日期和文件名生成；发布后尽量不要改文件名或日期。如果需要固定地址，可在元信息中添加 `permalink: "/2026/10/02/my-note/"`。原站的六篇文章已经设置固定地址，旧链接继续有效。

## 这次迁移

原仓库只有 Hexo 7.3.0 生成的静态网页，没有 Hexo 工程或 Markdown 源文件。本次从网页中恢复了 6 篇 Markdown，归入技术分类；已逐字核对文章文字和 30 个代码块。旧文章的 URL 与标题锚点保留。

主题使用暖白纸张色、墨绿点缀、中文衬线标题；提供独立分类页、归档、文章目录、代码复制、深浅色切换、标题/摘要/标签搜索，以及手机布局。内容与字体均不依赖第三方 CDN。

原应用隐私政策、支持页、`app-ads.txt`、文章图片保留。原始 `FreeRTOS/FreeRTOS使用技巧.md` 保留，并复制为 `草稿/技术/2026-10-02-freertos-tips.md`，可以整理后再发布。

验证命令：

```sh
npm test
npm run build
npm run check
```

样式预览与构建已可离线运行。联网推送和 GitHub Pages 的最终部署状态需要在可连接 GitHub 的终端确认。
