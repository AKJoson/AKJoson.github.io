import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readPosts, categories, slug, escape as e } from './content.mjs';
import { createRenderer } from './render.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preserved = ['privacy-policy.html', 'privacy-police-droidbrid.html', 'privacy-police-droidbridge', 'support.html', 'supportdb.html', 'app-ads.txt'];
const managed = name => ['index.html', '404.html', 'about/index.html', 'atom.xml', 'sitemap.xml', 'robots.txt'].includes(name) || /^(?:\d{4}\/\d{2}\/\d{2}\/[^/]+|archives(?:\/\d{4}(?:\/\d{2})?)?|categories\/(?:tech|life))\/index\.html$/.test(name);

export function build({ root = ROOT, out = root, drafts = false } = {}) {
  if (drafts && path.resolve(root) === path.resolve(out)) throw new Error('草稿只能构建到独立的预览目录，不能写入发布目录。');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
  const posts = readPosts(root, { drafts });
  const render = createRenderer(root, config, posts);
  const files = new Map();
  files.set('index.html', render.listing());
  for (const [name, key] of Object.entries(categories)) files.set(`categories/${key}/index.html`, render.listing(name));
  posts.forEach((post, index) => files.set(post.url.slice(1) + 'index.html', render.article(post, index)));
  for (const prefix of ['', ...new Set(posts.flatMap(p => [p.date.slice(0, 4), p.date.slice(0, 7)]))]) files.set(`archives/${prefix ? prefix.replaceAll('-', '/') + '/' : ''}index.html`, render.archive(prefix));
  files.set('about/index.html', render.about());
  files.set('404.html', render.notFound());
  const absolute = url => new URL(url, config.url).href;
  const updated = posts.length ? `${posts[0].date}T00:00:00+08:00` : '2026-01-01T00:00:00+08:00';
  files.set('atom.xml', `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>${e(config.title)}</title><subtitle>${e(config.description)}</subtitle><id>${e(absolute('/'))}</id><link href="${e(absolute('/atom.xml'))}" rel="self"/><link href="${e(absolute('/'))}"/><updated>${updated}</updated><author><name>${e(config.author)}</name></author>${posts.filter(p => !p.draft).map(p => `<entry><title>${e(p.title)}</title><id>${e(absolute(p.url))}</id><link href="${e(absolute(p.url))}"/><published>${p.date}T00:00:00+08:00</published><updated>${p.date}T00:00:00+08:00</updated><category term="${p.category}"/><summary>${e(p.summary)}</summary></entry>`).join('')}</feed>\n`);
  const pages = ['/', '/about/', '/archives/', ...Object.values(categories).map(k => `/categories/${k}/`), ...posts.filter(p => !p.draft).map(p => p.url)];
  files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(url => `<url><loc>${e(absolute(url))}</loc></url>`).join('')}</urlset>\n`);
  files.set('robots.txt', `User-agent: *\nAllow: /\nDisallow: /tooling/\nDisallow: /theme/\nDisallow: /文章/\nSitemap: ${absolute('/sitemap.xml')}\n`);
  for (const name of files.keys()) if (!managed(name) || name.includes('..')) throw new Error(`输出路径不合法：${name}`);
  // Render and validate all posts before changing any published page.
  fs.mkdirSync(out, { recursive: true });
  const manifestPath = path.join(out, '.site-manifest.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  for (const [name, html] of files) {
    const target = path.join(out, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Preview pages also open directly from Finder without a local web server.
    const rendered = path.resolve(out) !== path.resolve(root) && name.endsWith('.html')
      ? html.replace(/\b(href|src)="(\/[^"\s]*)"/g, (match, attribute, value) => {
        if (value.startsWith('//')) return match;
        const [pathname, suffix = ''] = value.split(/(?=[?#])/s, 2);
        const destination = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
        const relative = path.posix.relative(path.posix.dirname(name), destination);
        return `${attribute}="${relative || 'index.html'}${suffix}"`;
      }) : html;
    fs.writeFileSync(target, rendered);
  }
  for (const name of previous) {
    if (managed(name) && !name.includes('..') && !files.has(name)) fs.rmSync(path.join(out, name), { force: true });
  }
  fs.writeFileSync(manifestPath, JSON.stringify([...files.keys()].sort(), null, 2) + '\n');
  if (path.resolve(out) !== path.resolve(root)) {
    for (const folder of ['assets', 'images']) fs.cpSync(path.join(root, folder), path.join(out, folder), { recursive: true });
    for (const name of preserved) if (fs.existsSync(path.join(root, name))) fs.copyFileSync(path.join(root, name), path.join(out, name));
  }
  return { posts, files: [...files.keys()], out };
}

function newPost(args) {
  const [category, ...words] = args;
  const title = words.join(' ').trim();
  if (!Object.hasOwn(categories, category) || !title) throw new Error('用法：npm run new -- 技术 "文章标题"（也可以使用“日常随想”）');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const file = path.join(ROOT, '草稿', category, `${date}-${slug(title).slice(0, 80)}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const values = { title, date, category, tags: [], summary: '用一两句话介绍这篇文章。' };
  fs.writeFileSync(file, `---\n${Object.entries(values).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n## 从这里开始\n\n写下你的正文。\n`, { flag: 'wx' });
  console.log(`已创建草稿：${path.relative(ROOT, file)}\n写完后移到 文章/${category}/，运行 npm run publish 发布。\n预览草稿：npm run dev -- --drafts`);
}

function serve(args) {
  const drafts = args.includes('--drafts');
  const out = path.join(ROOT, '.preview-site');
  build({ out, drafts });
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
  const server = http.createServer((req, res) => {
    try {
      let route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (route.endsWith('/')) route += 'index.html';
      const file = path.resolve(out, `.${route}`);
      if (!file.startsWith(out + path.sep) || route.split('/').some(s => s.startsWith('.'))) { res.writeHead(403); res.end('Forbidden'); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Content-Type': types['.html'] }); res.end(fs.readFileSync(path.join(out, '404.html'))); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || (route.endsWith('/privacy-police-droidbridge') ? types['.html'] : 'application/octet-stream'), 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(400); res.end('Bad request'); }
  });
  server.on('error', error => { console.error(`无法启动预览：${error.message}`); process.exitCode = 1; clearInterval(watcher); });
  server.listen(4173, '127.0.0.1', () => console.log(`博客预览：http://127.0.0.1:4173${drafts ? '（包含草稿）' : ''}\n保存文章后自动重新构建，刷新浏览器即可查看。Ctrl+C 结束。`));
  function snapshot() {
    const state = [];
    const visit = dir => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile()) { const stat = fs.statSync(file); state.push(`${file}:${stat.mtimeMs}:${stat.size}`); }
      }
    };
    for (const folder of ['文章', 'theme', 'assets', 'images', ...(drafts ? ['草稿'] : [])]) visit(path.join(ROOT, folder));
    state.push(String(fs.statSync(path.join(ROOT, 'site.config.json')).mtimeMs));
    return state.sort().join('|');
  }
  let last = snapshot();
  const watcher = setInterval(() => {
    try {
      const current = snapshot();
      if (current !== last) { last = current; const result = build({ out, drafts }); console.log(`已更新 ${result.posts.length} 篇文章，请刷新浏览器。`); }
    } catch (error) { console.error(error.message); }
  }, 1000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(watcher); server.close(); });
}

function publish(args) {
  const run = (command, values, options = {}) => {
    const result = spawnSync(command, values, { cwd: ROOT, stdio: 'inherit', ...options });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || `${command} 失败，已停止发布；修复终端提示的问题后重试。`);
    return result;
  };
  run('git', ['rev-parse', '--show-toplevel']);
  build();
  run(process.execPath, ['tooling/check.mjs']);
  run('git', ['add', '-A', '--', '.']);
  const changes = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: ROOT });
  if (changes.status === 1) run('git', ['commit', '-m', args.join(' ') || '更新博客文章与主题']);
  else if (changes.status !== 0) throw new Error('无法检查 Git 暂存区。');
  run('git', ['push', 'origin', 'HEAD']);
  console.log('已推送到 GitHub。GitHub Pages 构建完成后可在 https://akjoson.github.io 查看。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , command = 'build', ...args] = process.argv;
    if (command === 'build') { const result = build(); console.log(`已构建 ${result.posts.length} 篇文章，${result.files.length} 个页面和索引文件。`); }
    else if (command === 'preview') { const result = build({ out: path.join(ROOT, '.preview-site'), drafts: args.includes('--drafts') }); console.log(`已生成 ${result.posts.length} 篇文章的本地预览。\n用浏览器打开：${path.join(result.out, 'index.html')}`); }
    else if (command === 'new') newPost(args);
    else if (command === 'dev') serve(args);
    else if (command === 'publish') publish(args);
    else throw new Error('可用命令：build、preview、dev、new、publish');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
