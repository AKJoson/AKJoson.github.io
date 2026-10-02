import fs from 'node:fs';
import path from 'node:path';
import { escape as e, categories, categoryDetails } from './content.mjs';

export function createRenderer(root, config, posts) {
  const part = name => fs.readFileSync(path.join(root, 'theme', `${name}.html`), 'utf8');
  const count = category => posts.filter(p => !category || p.category === category).length;
  const number = n => String(n).padStart(2, '0');
  const tags = post => `<div class="tags">${post.tags.map(t => `<span>${e(t)}</span>`).join('')}</div>`;
  const categoryLink = category => `/categories/${categories[category]}/`;
  const sidebar = () => part('sidebar').replace('{{CATEGORY_LINKS}}', Object.entries(categoryDetails).map(([name, details]) => `<a href="${categoryLink(name)}"><span class="category-icon" aria-hidden="true">${e(details.icon)}</span><span><strong>${e(name)}</strong><small>${e(details.summary)}</small></span><span aria-hidden="true">↗</span></a>`).join(''));
  function shell({ title, description = config.description, url, body, type = 'website', date }) {
    const canonical = new URL(url, config.url).href;
    const active = url.startsWith('/archives/') ? '/archives/' : url === '/about/' ? '/about/' : '/';
    const nav = part('header').replaceAll('https://github.com/AKJoson', e(config.github)).replace('<a href="' + active + '">', '<a href="' + active + '" aria-current="page">');
    const footer = part('footer').replaceAll('{{YEAR}}', String(new Date().getFullYear()));
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${e(title)} · ${e(config.title)}</title><meta name="description" content="${e(description)}"><meta name="author" content="${e(config.author)}"><link rel="canonical" href="${e(canonical)}"><meta property="og:type" content="${type}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:site_name" content="${e(config.title)}"><meta property="og:locale" content="zh_CN"><meta name="twitter:card" content="summary">${date ? `<meta property="article:published_time" content="${date}T00:00:00+08:00">` : ''}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" title="${e(config.title)}" href="/atom.xml"><script src="/assets/theme-init.js"></script><link rel="stylesheet" href="/assets/theme.css"><script src="/assets/theme.js" defer></script></head>
<body><a class="skip-link" href="#main">跳到正文</a><div class="site-shell">${nav}<main id="main">${body}</main>${footer}</div><span class="screen-reader-only" id="copy-status" role="status"></span></body></html>\n`;
  }
  function row(post) {
    return `<article class="article-row" data-search="${e([post.title, post.summary, ...post.tags].join(' ').toLocaleLowerCase())}"><div class="article-meta"><a class="category-label" href="${categoryLink(post.category)}">${e(post.category)}</a><time datetime="${post.date}">${post.date.replaceAll('-', ' / ')}</time>${post.draft ? '<span class="draft-label">草稿预览</span>' : ''}</div><h3><a href="${e(post.url)}">${e(post.title)}<span aria-hidden="true">↗</span></a></h3><p>${e(post.summary)}</p><div class="article-bottom">${tags(post)}<span class="read-note">约 ${post.minutes} 分钟阅读</span></div></article>`;
  }
  function filters(category) {
    return `<div class="journal-tools"><nav class="filters" aria-label="文章分类">${[['', '全部', '/'], ...Object.keys(categories).map(name => [name, name, categoryLink(name)])].map(([key, name, href]) => `<a href="${href}"${key === category ? ' class="active" aria-current="page"' : ''}>${name} <span>${number(count(key))}</span></a>`).join('')}</nav><label class="search-field"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.5"/></svg><input type="search" placeholder="找一篇文章…" aria-label="搜索${category || '全部'}文章的标题、摘要和标签" autocomplete="off"></label></div>`;
  }
  function listing(category = '') {
    const listed = posts.filter(p => !category || p.category === category);
    const heading = category || '最近写下的';
    const opening = category ? `<section class="page-heading"><p class="eyebrow">NOTES ON ${e(categoryDetails[category].label)}</p><h1>${category}</h1><p>${e(categoryDetails[category].description)}</p></section>` : part('hero');
    return shell({ title: category || '写代码，也写生活', url: category ? categoryLink(category) : '/', body: `${opening}<div class="journal-layout"><section id="journal" class="journal" aria-labelledby="journal-title"><div class="section-heading"><div><p class="eyebrow">THE JOURNAL</p><h2 id="journal-title">${heading}</h2></div><span class="article-count" aria-live="polite">${number(listed.length)} 篇笔记</span></div>${filters(category)}<div class="article-list">${listed.map(row).join('')}</div><div class="empty-state" ${listed.length ? 'hidden' : ''}><span aria-hidden="true">✳</span><h3>这一页，留给未来的灵感。</h3><p>还没有${category || ''}文章。下一次落笔，就从这里开始。</p></div><p class="list-end"><span></span> 写一点，积累一点 <span></span></p></section>${sidebar()}</div>` });
  }
  function article(post, index) {
    const adjacent = [[posts[index + 1], '上一篇'], [posts[index - 1], '下一篇']].filter(([p]) => p);
    const toc = post.toc.length ? `<aside class="post-sidebar"><nav class="toc" aria-label="文章目录"><p class="eyebrow">这篇文章里</p><ol>${post.toc.map(h => `<li class="toc-level-${h.level}"><a href="#${e(h.id)}" title="${e(h.title)}">${e(h.title)}</a></li>`).join('')}</ol><a class="back-to-top" href="#main">回到顶部 ↑</a></nav></aside>` : '';
    return shell({ title: post.title, description: post.summary, url: post.url, type: 'article', date: post.date, body: `<div class="post-breadcrumb"><a href="/">文章</a><span>/</span><a href="${categoryLink(post.category)}">${e(post.category)}</a></div>${post.draft ? '<div class="draft-banner">草稿预览 · 此文章不会包含在正式构建中</div>' : ''}<header class="post-header"><p class="eyebrow">${e(categoryDetails[post.category].label)}</p><h1>${e(post.title)}</h1><div class="post-meta"><span>${e(config.author)}</span><time datetime="${post.date}">${post.date}</time><span>约 ${post.minutes} 分钟阅读</span></div>${tags(post)}</header><div class="post-layout"><div class="post-main"><details class="mobile-toc"><summary>文章目录</summary><ol>${post.toc.map(h => `<li><a href="#${e(h.id)}">${e(h.title)}</a></li>`).join('')}</ol></details><article class="prose">${post.html}</article><div class="post-signoff"><span aria-hidden="true">✳</span><p>感谢你读到这里。</p><a class="text-link" href="${categoryLink(post.category)}">继续阅读${e(post.category)} <span aria-hidden="true">↗</span></a></div><nav class="adjacent-posts" aria-label="相邻文章">${adjacent.map(([p, label]) => `<a href="${e(p.url)}"><small>${label}</small><strong>${e(p.title)}</strong></a>`).join('')}</nav></div>${toc}</div>` });
  }
  function archive(prefix = '') {
    const listed = posts.filter(p => p.date.startsWith(prefix));
    const years = [...new Set(listed.map(p => p.date.slice(0, 4)))];
    return shell({ title: prefix ? `${prefix} 归档` : '文章归档', url: `/archives/${prefix ? prefix.replaceAll('-', '/') + '/' : ''}`, body: `<section class="page-heading"><p class="eyebrow">THROUGH THE YEARS</p><h1>写过的，都在这里。</h1><p>${prefix ? `${prefix} · ` : ''}共 ${listed.length} 篇文章，慢慢积累的记录。</p></section><div class="archive-list">${years.map(year => `<section><h2>${year}<span>${number(listed.filter(p => p.date.startsWith(year)).length)}</span></h2>${listed.filter(p => p.date.startsWith(year)).map(p => `<a class="archive-row" href="${e(p.url)}"><time datetime="${p.date}">${p.date.slice(5).replace('-', ' / ')}</time><span>${e(p.title)}</span><small>${p.category}</small><span aria-hidden="true">↗</span></a>`).join('')}</section>`).join('')}</div>` });
  }
  function about() {
    return shell({ title: '关于', url: '/about/', body: `<section class="page-heading"><p class="eyebrow">A LITTLE ABOUT ME</p><h1>你好，我是 ${e(config.author)}。</h1><p>写代码，也写生活。</p></section><article class="prose about-prose"><p>这里是我的个人博客。我把技术探索中的问题、实践和理解写下来，也为生活中的观察与想法留一点空间。</p><h2>这里写什么</h2>${Object.entries(categoryDetails).map(([name, details]) => `<p><a href="${categoryLink(name)}">${e(name)}</a>：${e(details.description)}</p>`).join('')}<blockquote><p>${e(config.motto)}</p></blockquote><p><a href="${e(config.github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a> · <a href="/atom.xml">订阅 RSS ↗</a></p></article>` });
  }
  function notFound() {
    return shell({ title: '页面未找到', url: '/404.html', body: '<section class="not-found page-heading"><p class="eyebrow">404 · PAGE NOT FOUND</p><h1>这一页，暂时翻不到。</h1><p>可能是地址写错了，也可能文章搬了家。</p><a class="text-link" href="/">回到首页 <span aria-hidden="true">↗</span></a></section>' });
  }
  return { listing, article, archive, about, notFound };
}
