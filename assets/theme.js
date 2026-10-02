(() => {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const preference = matchMedia('(prefers-color-scheme: dark)');
  let chosen = false;
  try { chosen = ['dark', 'light'].includes(localStorage.getItem('cherry-theme')); } catch (_) { /* Optional storage. */ }
  function themeLabel() {
    const label = root.dataset.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  }
  themeLabel();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    chosen = true;
    try { localStorage.setItem('cherry-theme', root.dataset.theme); } catch (_) { /* Keep the current page usable. */ }
    themeLabel();
  });
  preference.addEventListener('change', event => {
    if (!chosen) { root.dataset.theme = event.matches ? 'dark' : 'light'; themeLabel(); }
  });

  const search = document.querySelector('input[type="search"]');
  if (search) {
    const articles = [...document.querySelectorAll('.article-row')];
    const empty = document.querySelector('.empty-state');
    const emptyHeading = empty.querySelector('h3').textContent;
    const emptyMessage = empty.querySelector('p').textContent;
    search.addEventListener('input', () => {
      const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let visible = 0;
      articles.forEach(article => {
        article.hidden = !terms.every(term => article.dataset.search.includes(term));
        if (!article.hidden) visible += 1;
      });
      document.querySelector('.article-count').textContent = `${String(visible).padStart(2, '0')} 篇笔记`;
      empty.hidden = visible !== 0;
      empty.querySelector('h3').textContent = terms.length ? '暂时没有找到这篇文章。' : emptyHeading;
      empty.querySelector('p').textContent = terms.length ? '试试其他关键词，或切换文章分类。' : emptyMessage;
    });
  }

  document.querySelectorAll('.copy-code').forEach(button => {
    button.addEventListener('click', async () => {
      const code = button.closest('.code-block').querySelector('code');
      const status = document.querySelector('#copy-status');
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = '已复制 ✓';
        status.textContent = '代码已复制';
      } catch (_) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = '已选中';
        status.textContent = '代码已选中，请按 Command+C 或 Ctrl+C 复制';
      }
      setTimeout(() => { button.textContent = '复制'; }, 2000);
    });
  });
})();
