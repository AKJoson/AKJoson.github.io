import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPosts } from './content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = JSON.parse(fs.readFileSync(path.join(root, '.site-manifest.json'), 'utf8'));
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/gi, "'");
const pages = new Map();
const issues = [];
for (const file of files.filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]*)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) issues.push(`${file}：存在重复 id`);
  if (!html.includes('<html lang="zh-CN">')) issues.push(`${file}：缺少中文页面语言`);
  if (html.includes('http://example.com')) issues.push(`${file}：仍有旧站占位域名`);
  pages.set(file, { html, ids: new Set(ids) });
}
for (const [file, page] of pages) {
  for (const match of page.html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const href = decode(match[1]);
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
    const url = new URL(href, `https://local.test/${file}`);
    let target = decodeURIComponent(url.pathname).slice(1);
    const full = path.join(root, target);
    if (!full.startsWith(root + path.sep) && full !== root) { issues.push(`${file}：链接越界 ${href}`); continue; }
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(path.join(root, target))) issues.push(`${file}：链接不存在 ${href}`);
    else if (url.hash && pages.has(target) && !pages.get(target).ids.has(decodeURIComponent(url.hash.slice(1)))) issues.push(`${file}：锚点不存在 ${href}`);
  }
}
const expected = readPosts(root).map(post => post.url.slice(1) + 'index.html');
for (const file of expected) if (!pages.has(file)) issues.push(`文章未生成：${file}`);
for (const file of files.filter(f => /^\d{4}\//.test(f))) if (!expected.includes(file)) issues.push(`发布目录包含已撤回或草稿文章：${file}`);
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log(`检查通过：${pages.size} 个页面，${expected.length} 篇文章；站内链接、锚点和分类输出有效。`);
