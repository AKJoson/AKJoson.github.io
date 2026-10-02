# Markdown 解析器

`markdown-it.cjs` 是 markdown-it 12.0.6 的独立 UMD 构建，无运行时依赖。
来源：本机微信开发者工具所附的 `node_modules/markdown-it/dist/markdown-it.js`，文件保留上游版本与 MIT 声明，完整许可见同目录 LICENSE.markdown-it。

固定解析器使本项目只需 Node.js，即可离线构建；不依赖机器上的微信开发者工具。
用于构建作者自己的 Markdown，默认禁用自动链接识别。升级时从 markdown-it 官方 npm 包替换独立构建并运行 `npm test` 与 `npm run check`。
