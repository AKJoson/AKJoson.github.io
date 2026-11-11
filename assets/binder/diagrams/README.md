# diagrams —— Binder 流程图源文件

本目录是 `C:\binder` 各章文档里 mermaid 图的**独立源码**。`.mmd` 文件可以直接用
[mermaid-cli](https://github.com/mermaid-js/mermaid-cli) 或支持 mermaid 的编辑器渲染。

## 文件清单

| 文件 | 对应文档 | 说明 |
|------|----------|------|
| `01-整体架构.mmd` | `01-架构总览.md` | 四层架构 |
| `02-对象模型.mmd` | `03-RPC原理.md` | Proxy/Stub/Handle/Node 的对应关系 |
| `03-同步RPC时序.mmd` | `05-完整消息流转.md` | **核心**：一次同步调用端到端时序 |
| `04-内核数据结构.mmd` | `04-内核数据结构.md` | proc/thread/node/ref/buffer 关系 |
| `05-一次拷贝.mmd` | `04-内核数据结构.md` | 缓冲区在接收方 + 一次拷贝 |
| `06-oneway时序.mmd` | `05-完整消息流转.md` | 异步单向调用 |
| `07-死亡通知.mmd` | `06-进阶专题.md` | linkToDeath 全流程 |
| `08-线程池扩充.mmd` | `06-进阶专题.md` | BR_SPAWN_LOOPER |
| `09-消息封装层次.mmd` | `02-消息封装.md` | 三层套娃 |
| `10-对象翻译.mmd` | `02-消息封装.md` | flat_binder_object 跨进程翻译 |

---

## 方式一：直接在编辑器里看（最简单）

- **VS Code**：装 `Markdown Preview Mermaid Support` 扩展，打开 `.md` 文档即可预览。
- **Typora**：原生支持 mermaid。
- **GitHub / GitLab**：`.md` 里的 ```` ```mermaid ```` 代码块会自动渲染。
- **在线**：把 `.mmd` 内容粘到 <https://mermaid.live> 即可看和导出 PNG/SVG。

---

## 方式二：命令行渲染成 PNG / SVG

需要 Node.js（本机已有 v24）。

```bash
# 在 C:\binder 目录下执行

# 安装（会下载 Chromium，约 200MB，只需一次）
npm install --no-save @mermaid-js/mermaid-cli

# 渲染单个文件
npx mmdc -i diagrams/03-同步RPC时序.mmd -o diagrams/out/03-同步RPC时序.png -w 2400 -b white

# 批量渲染（见下面脚本）
```

### Windows (Git Bash / cmd)

```bash
bash diagrams/render.sh          # Git Bash
diagrams\render.bat              # cmd / PowerShell
```

### 输出

渲染结果默认输出到 `diagrams/out/`。

---

## 方式三：用 Python + kroki 服务

如果装了 Docker，可以用 kroki 一次渲染全部：

```bash
docker run -d -p 8000:8000 yuzutech/kroki
# 然后 POST .mmd 内容到 http://localhost:8000/mermaid/svg
```

---

## 常见问题

**Q: 中文字体显示成方块？**
mermaid-cli 需要一个配置文件指定字体和 puppeteer 参数。在 `C:\binder` 下建 `puppeteer-config.json`：

```json
{ "args": ["--no-sandbox"] }
```

并确保系统装了中文字体（Windows 一般有 `Microsoft YaHei`）。

**Q: `mmdc` 报 Chromium 下载失败？**
设置镜像后重装：

```bash
export PUPPETEER_DOWNLOAD_BASE_URL=https://npmmirror.com/mirrors/chrome-for-testing
npm install --no-save @mermaid-js/mermaid-cli
```

**Q: 图太大看不清？**
用 `-w 2400`（宽度）和 `-H`（高度）参数，或改用 `-o out.svg` 输出矢量图。
