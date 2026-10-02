import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from './vendor/markdown-it.cjs';

// Category names and hierarchy come only from folders, never a manual registry.
export function validCategoryPath(value) {
  return typeof value === 'string' && value.split('/').every(part => part.trim() && !part.startsWith('.') && !/[\\\u0000-\u001f]/.test(part));
}
export const categoryUrl = category => `/categories/${category.split('/').map(encodeURIComponent).join('/')}/`;

export function discoverCategories(root, { drafts = false } = {}) {
  const registry = Object.create(null);
  const register = category => {
    if (Object.hasOwn(registry, category)) return;
    if (!validCategoryPath(category)) throw new Error(`分类目录名称不合法：${category}`);
    const parts = category.split('/');
    const name = parts.at(-1);
    registry[category] = {
      name, path: category, parent: parts.slice(0, -1).join('/'),
      label: parts.length > 1 ? 'TOPIC NOTES' : 'THE JOURNAL', icon: '▤',
      summary: `关于${name}的记录`, description: `关于「${name}」的笔记与思考。`
    };
  };
  const scan = (directory, parent = '') => {
    if (!fs.existsSync(directory)) return;
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        const category = parent ? `${parent}/${entry.name}` : entry.name;
        register(category);
        scan(path.join(directory, entry.name), category);
      } else if (!parent && entry.isFile() && entry.name.endsWith('.md')) {
        register('未分类');
      }
    }
  };
  scan(path.join(root, '文章'));
  if (drafts) scan(path.join(root, '草稿'));
  return registry;
}

export const inCategory = (post, category = '') => !category || post.category === category || post.category.startsWith(`${category}/`);
export const categoryAncestors = category => category.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'));
export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const slug = value => String(value).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'note';

// A deliberately small, documented front-matter format. Values are plain strings
// or JSON strings/arrays/booleans; unsupported YAML fails instead of guessing.
export function parsePost(source, filename = '文章', folderCategory) {
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
  for (const key of ['title', 'date']) {
    if (typeof meta[key] !== 'string' || !meta[key].trim()) throw new Error(`${filename}：缺少 ${key}`);
  }
  // Existing category fields remain readable, but folder membership wins.
  const category = folderCategory ?? meta.category ?? '未分类';
  if (!validCategoryPath(category)) throw new Error(`${filename}：分类目录名称不合法`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || !Number.isFinite(Date.parse(meta.date)) || new Date(meta.date).toISOString().slice(0, 10) !== meta.date) throw new Error(`${filename}：日期必须是有效的 YYYY-MM-DD`);
  if (meta.draft !== undefined && typeof meta.draft !== 'boolean') throw new Error(`${filename}：draft 只能是 true 或 false`);
  if (meta.tags !== undefined && (!Array.isArray(meta.tags) || meta.tags.some(t => typeof t !== 'string'))) throw new Error(`${filename}：tags 必须是字符串数组`);
  if (meta.summary !== undefined && typeof meta.summary !== 'string') throw new Error(`${filename}：summary 必须是字符串`);
  if (meta.permalink !== undefined && typeof meta.permalink !== 'string') throw new Error(`${filename}：permalink 必须是字符串`);
  const url = meta.permalink || `/${meta.date.replaceAll('-', '/')}/${slug(path.basename(filename, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, ''))}/`;
  if (!/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(url) || /[%\\?#\u0000-\u001f]/.test(url) || url.split('/').some(p => p === '.' || p === '..')) throw new Error(`${filename}：permalink 应为 /年/月/日/文章名称/，不可包含路径跳转或 URL 转义`);
  return { ...meta, category, tags: meta.tags || [], summary: meta.summary || '', url, markdown: match[2], filename };
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
  function walk(dir, isDraft, category = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, isDraft, category ? `${category}/${entry.name}` : entry.name);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push({ full, isDraft, category: category || '未分类' });
    }
  }
  walk(path.join(root, '文章'), false);
  if (drafts) walk(path.join(root, '草稿'), true);
  const posts = files.map(({ full, isDraft, category }) => {
    const post = parsePost(fs.readFileSync(full, 'utf8'), full, category);
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
