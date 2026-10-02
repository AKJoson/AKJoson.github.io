import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from './vendor/markdown-it.cjs';

export const categories = { '技术': 'tech', '日常随想': 'life' };
export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const slug = value => String(value).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'note';

// A deliberately small, documented front-matter format. Values are plain strings
// or JSON strings/arrays/booleans; unsupported YAML fails instead of guessing.
export function parsePost(source, filename = '文章') {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${filename}：文章开头需要 --- 元信息 ---`);
  const meta = {};
  const allowed = new Set(['title', 'date', 'category', 'tags', 'summary', 'permalink', 'draft']);
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const pair = line.match(/^([a-z]+):\s*(.*?)\s*$/);
    if (!pair || !allowed.has(pair[1]) || Object.hasOwn(meta, pair[1])) throw new Error(`${filename}：无法识别或重复的元信息：${line}`);
    const raw = pair[2];
    try { meta[pair[1]] = /^(?:["\[{]|true$|false$|null$)/.test(raw) ? JSON.parse(raw) : raw; }
    catch { throw new Error(`${filename}：${pair[1]} 的格式错误，字符串请用双引号，标签请用 JSON 数组`); }
  }
  for (const key of ['title', 'date', 'category']) {
    if (typeof meta[key] !== 'string' || !meta[key].trim()) throw new Error(`${filename}：缺少 ${key}`);
  }
  if (!Object.hasOwn(categories, meta.category)) throw new Error(`${filename}：分类只能是“技术”或“日常随想”`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || !Number.isFinite(Date.parse(meta.date)) || new Date(meta.date).toISOString().slice(0, 10) !== meta.date) throw new Error(`${filename}：日期必须是有效的 YYYY-MM-DD`);
  if (meta.draft !== undefined && typeof meta.draft !== 'boolean') throw new Error(`${filename}：draft 只能是 true 或 false`);
  if (meta.tags !== undefined && (!Array.isArray(meta.tags) || meta.tags.some(t => typeof t !== 'string'))) throw new Error(`${filename}：tags 必须是字符串数组`);
  if (meta.summary !== undefined && typeof meta.summary !== 'string') throw new Error(`${filename}：summary 必须是字符串`);
  if (meta.permalink !== undefined && typeof meta.permalink !== 'string') throw new Error(`${filename}：permalink 必须是字符串`);
  const url = meta.permalink || `/${meta.date.replaceAll('-', '/')}/${slug(path.basename(filename, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, ''))}/`;
  if (!/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(url) || /[%\\?#\u0000-\u001f]/.test(url) || url.split('/').some(p => p === '.' || p === '..')) throw new Error(`${filename}：permalink 应为 /年/月/日/文章名称/，不可包含路径跳转或 URL 转义`);
  return { ...meta, tags: meta.tags || [], summary: meta.summary || '', url, markdown: match[2], filename };
}

export function renderMarkdown(source) {
  const toc = [];
  const used = new Map();
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  md.renderer.rules.heading_open = (tokens, index) => {
    const title = tokens[index + 1].children?.map(t => t.type === 'html_inline' ? '' : t.content).join('') || tokens[index + 1].content;
    const base = `section-${slug(title)}`;
    const repeat = (used.get(base) || 0) + 1;
    used.set(base, repeat);
    const id = repeat === 1 ? base : `${base}-${repeat}`;
    toc.push({ id, title, level: Number(tokens[index].tag.slice(1)) });
    return `<${tokens[index].tag} id="${escape(id)}">`;
  };
  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/)[0] || 'text';
    return `<div class="code-block"><div class="code-toolbar"><span>${escape(language)}</span><button type="button" class="copy-code" aria-label="复制代码">复制</button></div><pre tabindex="0"><code class="language-${escape(language)}">${escape(token.content)}</code></pre></div>\n`;
  };
  const html = md.render(source).replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, toc };
}

export function readPosts(root, { drafts = false } = {}) {
  const files = [];
  function walk(dir, isDraft) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, isDraft);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push({ full, isDraft });
    }
  }
  walk(path.join(root, '文章'), false);
  if (drafts) walk(path.join(root, '草稿'), true);
  const posts = files.map(({ full, isDraft }) => {
    const post = parsePost(fs.readFileSync(full, 'utf8'), full);
    return { ...post, draft: isDraft || post.draft === true };
  }).filter(post => drafts || !post.draft).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'));
  const urls = new Set();
  for (const post of posts) {
    if (urls.has(post.url)) throw new Error(`文章地址重复：${post.url}`);
    urls.add(post.url);
    Object.assign(post, renderMarkdown(post.markdown));
    post.minutes = Math.max(1, Math.ceil(post.markdown.length / 600));
  }
  return posts;
}
