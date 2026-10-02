# 博客维护约定

- 此目录对应 `AKJoson/AKJoson.github.io`，站点为 `https://akjoson.github.io`，原默认分支是 `master`。
- 正式文章源文件放在 `文章/技术/`、`文章/日常随想/` 或 `文章/读书感悟/`，使用 README 说明的 Markdown 元信息格式。技术实践归入“技术”，生活感受归入“日常随想”，阅读摘记与思考归入“读书感悟”。分类定义集中在 `tooling/content.mjs` 的 `categoryDetails`。
- 未完成的文章放在被 Git 忽略的 `草稿/`。不要把本地草稿、原始 `FreeRTOS/` 笔记或 `.preview-site/` 预览上传。
- 只编辑 Markdown、`theme/` 和 `assets/` 等源文件；根目录首页、年份目录里的文章 HTML、分类与归档页由 `npm run build` 生成。
- 保留旧文章的 `permalink` 和原有标题锚点，避免让外部链接失效。文章图片统一放在 `images/`。
- `privacy-policy.html`、`privacy-police-droidbrid.html`、`privacy-police-droidbridge`、`support.html`、`supportdb.html`、`app-ads.txt` 是应用使用的既有页面，不应随主题调整改写。
- 构建无需联网或安装依赖。内容更新后运行 `npm run build` 和 `npm run check`；修改构建工具时再运行 `npm test`。
- 用户要求发布时，`npm run publish -- "提交说明"` 会构建、检查、提交并推送，不要强制推送。明确区分本地完成、GitHub 推送成功、线上部署成功。
