import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePost, readPosts, renderMarkdown, categoryUrl, discoverCategories } from './content.mjs';
import { build, newPost, ROOT } from './blog.mjs';

const source = (extra = '', body = '## 正文\n\n一段记录。') => `---\ntitle: "测试文章"\ndate: "2026-10-02"\ncategory: "计算机"\ntags: ["C++", "笔记"]\n${extra}\n---\n\n${body}\n`;
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-blog-test-'));
  for (const folder of ['theme', 'assets', 'images']) fs.cpSync(path.join(ROOT, folder), path.join(dir, folder), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'site.config.json'), path.join(dir, 'site.config.json'));
  for (const folder of ['计算机/组成原理', '计算机/Kotlin', '计算机/C++', '日常随想', '读书感悟']) fs.mkdirSync(path.join(dir, '文章', folder), { recursive: true });
  fs.mkdirSync(path.join(dir, '草稿/计算机'), { recursive: true });
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

test('无效日期、重复字段和越界地址会在写文件前拒绝', () => {
  for (const text of [
    source().replace('2026-10-02', '2026-02-30'),
    source('title: "重复"'), source('tags: abc'), source('draft: "false"'),
    source('permalink: "/../../privacy-policy.html"'),
    source('permalink: "/2026/10/02/%2e%2e/"')
  ]) assert.throws(() => parsePost(text));
});

test('正式构建排除草稿，预览可显示，草稿不可写入发布根目录', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, '文章/计算机/published.md'), source());
  fs.writeFileSync(path.join(dir, '草稿/计算机/secret.md'), source('', '草稿独有内容'));
  fs.writeFileSync(path.join(dir, '文章/计算机/hidden.md'), source('draft: true'));
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
  const file = path.join(dir, '文章/计算机/remove-me.md');
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
  fs.writeFileSync(path.join(dir, '文章/计算机/a.md'), content);
  build({ root: dir });
  const before = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dir, '文章/计算机/b.md'), content);
  assert.throws(() => readPosts(dir), /地址重复/);
  assert.throws(() => build({ root: dir }), /地址重复/);
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), before);
});

test('摘要和标题中的 HTML 作为文字输出', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, '文章/计算机/escaping.md'), source('summary: "<script>alert(1)</script>"').replace('测试文章', '<img src=x onerror=alert(1)>'));
  build({ root: dir });
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('读书文章出现在首页、专属分类、归档与订阅中，使用读书页签', t => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, '文章/读书感悟'), { recursive: true });
  const reading = source('', '## 读完之后\n\n书里的一句话。').replace('category: "计算机"', 'category: "读书感悟"').replace('测试文章', '活着读后感');
  fs.writeFileSync(path.join(dir, '文章/读书感悟/reading-note.md'), reading);
  build({ root: dir });
  const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
  for (const file of ['index.html', 'categories/reading/index.html', 'archives/index.html', 'atom.xml']) assert.match(read(file), /活着读后感/);
  assert.doesNotMatch(read('categories/tech/index.html'), /活着读后感/);
  assert.doesNotMatch(read('categories/life/index.html'), /活着读后感/);
  assert.match(read('categories/读书感悟/index.html'), /<h1>读书感悟<\/h1>/);
  assert.ok(read('categories/读书感悟/index.html').includes(`href="${categoryUrl('读书感悟')}" class="active" aria-current="page"`));
  assert.ok(read('2026/10/02/reading-note/index.html').includes(categoryUrl('读书感悟')));
  assert.match(read('about/index.html'), /读书感悟/);
  assert.ok(read('sitemap.xml').includes(categoryUrl('读书感悟')));
  assert.doesNotMatch(read('index.html'), /\{\{CATEGORY_LINKS\}\}/);
});

test('计算机汇总父目录与子分类，子分类只显示自己的文章并保留旧分类入口', t => {
  const dir = fixture(t);
  const entries = [
    ['计算机', 'general', '计算机通用笔记'],
    ['计算机/C++', 'cpp-note', '智能指针与所有权'],
    ['计算机/Kotlin', 'kotlin-note', 'Kotlin 协程实践'],
    ['读书感悟', 'reading-note', '我的读书记录']
  ];
  for (const [category, name, title] of entries) {
    const folder = path.join(dir, '文章', category);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, `${name}.md`), source().replace('category: "计算机"', `category: "${category}"`).replace('测试文章', title));
  }
  build({ root: dir });
  const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
  const parent = read('categories/计算机/index.html');
  const cpp = read('categories/计算机/C++/index.html');
  for (const title of entries.slice(0, 3).map(entry => entry[2])) assert.ok(parent.includes(title));
  assert.doesNotMatch(parent, /我的读书记录/);
  assert.match(parent, /class="article-count" aria-live="polite">03 篇笔记/);
  assert.match(cpp, /智能指针与所有权/);
  assert.doesNotMatch(cpp, /计算机通用笔记|Kotlin 协程实践|我的读书记录/);
  assert.ok(cpp.includes(`href="${categoryUrl('计算机/C++')}" class="active" aria-current="page"`));
  assert.match(cpp, /class="article-count" aria-live="polite">01 篇笔记/);
  assert.match(read('categories/computer/architecture/index.html'), /还没有组成原理文章/);
  assert.equal(read('categories/tech/index.html'), parent);
  const breadcrumb = read('2026/10/02/cpp-note/index.html').match(/<nav class="post-breadcrumb"[^]*?<\/nav>/)[0];
  assert.ok(breadcrumb.includes(categoryUrl('计算机')) && breadcrumb.includes(categoryUrl('计算机/C++')));
  assert.ok(read('sitemap.xml').includes(categoryUrl('计算机/C++')));
  assert.doesNotMatch(read('sitemap.xml'), /categories\/tech\//);
  const topTabs = read('index.html').match(/<nav class="filters" aria-label="文章分类">(.*?)<\/nav>/)[1];
  assert.match(topTabs, /计算机/);
  assert.doesNotMatch(topTabs, /C\+\+|Kotlin|组成原理/);
});

test('完整子分类路径的新建、草稿预览和移入正式目录流程可用', t => {
  const dir = fixture(t);
  const draft = newPost(['计算机/Kotlin', '协程笔记'], dir);
  assert.equal(path.dirname(draft), path.join(dir, '草稿/计算机/Kotlin'));
  const post = parsePost(fs.readFileSync(draft, 'utf8'), draft);
  assert.doesNotMatch(fs.readFileSync(draft, 'utf8'), /^category:/m);
  assert.equal(readPosts(dir, { drafts: true })[0].category, '计算机/Kotlin');
  assert.equal(build({ root: dir }).posts.length, 0);
  assert.equal(build({ root: dir, out: path.join(dir, '.preview-site'), drafts: true }).posts.length, 1);
  const folder = path.join(dir, '文章/计算机/Kotlin');
  fs.mkdirSync(folder, { recursive: true });
  fs.renameSync(draft, path.join(folder, path.basename(draft)));
  const published = build({ root: dir });
  assert.equal(published.posts.length, 1);
  assert.equal(published.posts[0].url, post.url);
  assert.match(fs.readFileSync(path.join(dir, 'categories/computer/kotlin/index.html'), 'utf8'), /协程笔记/);
});

test('新建、重命名和移动文件夹即可改变归类，旧字段不会覆盖目录', t => {
  const dir = fixture(t);
  const oldFolder = path.join(dir, '文章/计算机/Kotlin');
  fs.writeFileSync(path.join(oldFolder, 'note.md'), source().replace('category: "计算机"', 'category: "已过时的分类"'));
  const before = build({ root: dir }).posts[0];
  assert.equal(before.category, '计算机/Kotlin');
  const renamed = path.join(dir, '文章/计算机/语言笔记');
  fs.renameSync(oldFolder, renamed);
  let result = build({ root: dir });
  assert.equal(result.posts[0].category, '计算机/语言笔记');
  assert.equal(result.posts[0].url, before.url);
  assert.equal(fs.existsSync(path.join(dir, 'categories/计算机/Kotlin/index.html')), false);
  assert.equal(fs.existsSync(path.join(dir, 'categories/computer/kotlin/index.html')), false);
  const destination = path.join(dir, '文章/学习/编程');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(renamed, destination);
  result = build({ root: dir });
  assert.equal(result.posts[0].category, '学习/编程');
  assert.equal(result.posts[0].url, before.url);
  assert.match(fs.readFileSync(path.join(dir, 'categories/学习/index.html'), 'utf8'), /测试文章/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'categories/计算机/index.html'), 'utf8'), /测试文章/);
  assert.equal(fs.existsSync(path.join(dir, 'categories/计算机/语言笔记/index.html')), false);
});

test('空文件夹自动成为可同步的分类，删除文件夹会移除分类页', t => {
  const dir = fixture(t);
  const folder = path.join(dir, '文章/随手记');
  fs.mkdirSync(folder);
  fs.mkdirSync(path.join(dir, '文章/.隐藏目录'));
  build({ root: dir });
  assert.equal(fs.existsSync(path.join(folder, '.gitkeep')), true);
  assert.ok(Object.hasOwn(discoverCategories(dir), '随手记'));
  assert.equal(Object.hasOwn(discoverCategories(dir), '.隐藏目录'), false);
  assert.match(fs.readFileSync(path.join(dir, 'categories/随手记/index.html'), 'utf8'), /还没有随手记文章/);
  fs.rmSync(folder, { recursive: true });
  build({ root: dir });
  assert.equal(fs.existsSync(path.join(dir, 'categories/随手记/index.html')), false);
});

test('中文、空格与特殊符号的目录地址会正确编码，根目录文章归入未分类', t => {
  const dir = fixture(t);
  const category = '开发/C++ & C# 入门';
  const folder = path.join(dir, '文章', category);
  fs.mkdirSync(folder, { recursive: true });
  const withoutCategory = source().replace(/^category:.*\n/m, '');
  fs.writeFileSync(path.join(folder, 'symbols.md'), withoutCategory);
  fs.writeFileSync(path.join(dir, '文章/root.md'), withoutCategory.replace('测试文章', '根目录笔记'));
  const result = build({ root: dir });
  assert.equal(result.posts.find(p => p.filename.endsWith('symbols.md')).category, category);
  assert.equal(result.posts.find(p => p.filename.endsWith('root.md')).category, '未分类');
  const index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(index.includes(categoryUrl(category)));
  assert.ok(categoryUrl(category).includes('C%2B%2B%20%26%20C%23'));
  assert.equal(fs.existsSync(path.join(dir, 'categories', category, 'index.html')), true);
  assert.match(fs.readFileSync(path.join(dir, 'atom.xml'), 'utf8'), /C\+\+ &amp; C# 入门/);
});

test('新建命令接受自定义文件夹路径并拒绝目录跳转', t => {
  const dir = fixture(t);
  const draft = newPost(['新领域/新主题', '一篇笔记'], dir);
  assert.equal(path.dirname(draft), path.join(dir, '草稿/新领域/新主题'));
  for (const category of ['../越界', '/绝对路径', '目录//空层级', '.隐藏目录', '目录/../跳转', '目录\\跳转']) {
    assert.throws(() => newPost([category, '标题'], dir));
  }
});
