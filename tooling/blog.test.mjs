import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePost, readPosts, renderMarkdown } from './content.mjs';
import { build, ROOT } from './blog.mjs';

const source = (extra = '', body = '## 正文\n\n一段记录。') => `---\ntitle: "测试文章"\ndate: "2026-10-02"\ncategory: "技术"\ntags: ["C++", "笔记"]\n${extra}\n---\n\n${body}\n`;
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-blog-test-'));
  for (const folder of ['theme', 'assets', 'images']) fs.cpSync(path.join(ROOT, folder), path.join(dir, folder), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'site.config.json'), path.join(dir, 'site.config.json'));
  fs.mkdirSync(path.join(dir, '文章/技术'), { recursive: true });
  fs.mkdirSync(path.join(dir, '草稿/技术'), { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('中文元信息、代码与 Markdown 表格可正确渲染', () => {
  const post = parsePost(source('', '## 同名\n\n## 同名\n\n```cpp\nif (a < b) { return "中文"; }\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'), '2026-10-02-笔记.md');
  const result = renderMarkdown(post.markdown);
  assert.equal(post.url, '/2026/10/02/笔记/');
  assert.deepEqual(result.toc.map(h => h.id), ['section-同名', 'section-同名-2']);
  assert.match(result.html, /a &lt; b/);
  assert.match(result.html, /<div class="table-scroll"><table>/);
  assert.match(result.html, /copy-code/);
});

test('无效分类、日期、重复字段和越界地址会在写文件前拒绝', () => {
  for (const text of [
    source().replace('category: "技术"', 'category: "其他"'),
    source().replace('2026-10-02', '2026-02-30'),
    source('title: "重复"'), source('tags: abc'), source('draft: "false"'),
    source('permalink: "/../../privacy-policy.html"'),
    source('permalink: "/2026/10/02/%2e%2e/"')
  ]) assert.throws(() => parsePost(text));
});

test('正式构建排除草稿，预览可显示，草稿不可写入发布根目录', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, '文章/技术/published.md'), source());
  fs.writeFileSync(path.join(dir, '草稿/技术/secret.md'), source('', '草稿独有内容'));
  fs.writeFileSync(path.join(dir, '文章/技术/hidden.md'), source('draft: true'));
  const result = build({ root: dir });
  assert.equal(result.posts.length, 1);
  assert.equal(fs.existsSync(path.join(dir, '2026/10/02/secret/index.html')), false);
  assert.throws(() => build({ root: dir, drafts: true }));
  const preview = build({ root: dir, out: path.join(dir, '.preview-site'), drafts: true });
  assert.equal(preview.posts.length, 3);
  assert.match(fs.readFileSync(path.join(dir, '.preview-site/2026/10/02/secret/index.html'), 'utf8'), /草稿预览/);
  assert.match(fs.readFileSync(path.join(dir, '.preview-site/2026/10/02/secret/index.html'), 'utf8'), /href="\.\.\/\.\.\/\.\.\/\.\.\/assets\/theme.css"/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'atom.xml'), 'utf8'), /secret/);
});

test('文章删除后撤回旧输出，同时保留应用支持页面', t => {
  const dir = fixture(t);
  const file = path.join(dir, '文章/技术/remove-me.md');
  fs.writeFileSync(file, source());
  fs.writeFileSync(path.join(dir, 'privacy-policy.html'), '原来的隐私政策');
  build({ root: dir });
  fs.unlinkSync(file);
  build({ root: dir });
  assert.equal(fs.existsSync(path.join(dir, '2026/10/02/remove-me/index.html')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'privacy-policy.html'), 'utf8'), '原来的隐私政策');
});

test('重复文章地址会拒绝构建，保留上一次成功结果', t => {
  const dir = fixture(t);
  const content = source('permalink: "/2026/10/02/same/"');
  fs.writeFileSync(path.join(dir, '文章/技术/a.md'), content);
  build({ root: dir });
  const before = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dir, '文章/技术/b.md'), content);
  assert.throws(() => readPosts(dir), /地址重复/);
  assert.throws(() => build({ root: dir }), /地址重复/);
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), before);
});

test('摘要和标题中的 HTML 作为文字输出', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, '文章/技术/escaping.md'), source('summary: "<script>alert(1)</script>"').replace('测试文章', '<img src=x onerror=alert(1)>'));
  build({ root: dir });
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('读书文章出现在首页、专属分类、归档与订阅中，使用读书页签', t => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, '文章/读书感悟'), { recursive: true });
  const reading = source('', '## 读完之后\n\n书里的一句话。').replace('category: "技术"', 'category: "读书感悟"').replace('测试文章', '活着读后感');
  fs.writeFileSync(path.join(dir, '文章/读书感悟/reading-note.md'), reading);
  build({ root: dir });
  const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
  for (const file of ['index.html', 'categories/reading/index.html', 'archives/index.html', 'atom.xml']) assert.match(read(file), /活着读后感/);
  assert.doesNotMatch(read('categories/tech/index.html'), /活着读后感/);
  assert.doesNotMatch(read('categories/life/index.html'), /活着读后感/);
  assert.match(read('categories/reading/index.html'), /NOTES ON READING/);
  assert.match(read('categories/reading/index.html'), /href="\/categories\/reading\/" class="active" aria-current="page"/);
  assert.match(read('2026/10/02/reading-note/index.html'), /<p class="eyebrow">READING<\/p>/);
  assert.match(read('about/index.html'), /读书感悟/);
  assert.match(read('sitemap.xml'), /categories\/reading\//);
  assert.doesNotMatch(read('index.html'), /\{\{CATEGORY_LINKS\}\}/);
});
