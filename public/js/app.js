/**
 * SnipFlow - 主应用 (SPA 路由)
 */

let currentPage = 'home';

function getCurrentPage() { return currentPage; }

function navigateTo(path) {
  // 更新 URL hash
  window.location.hash = path;
  renderPage(path);
}

function renderPage(path) {
  currentPage = path || 'home';
  updateNav();

  if (!path || path === '' || path === 'home') {
    renderHome();
  } else if (path === 'explore') {
    renderExplore();
  } else if (path === 'login') {
    renderLogin();
  } else if (path === 'register') {
    renderRegister();
  } else if (path === 'pricing') {
    renderPricing();
  } else if (path === 'dashboard') {
    renderDashboard();
  } else if (path.startsWith('snippet/')) {
    const uuid = path.split('/')[1];
    renderSnippetDetail(uuid);
  } else if (path.startsWith('share/')) {
    const code = path.split('/')[1];
    renderSharedSnippet(code);
  } else {
    renderHome();
  }
}

// ===== 首页 (专业版 Landing Page) =====
function renderHome() {
  const el = document.getElementById('mainContent');
  const isLogged = isLoggedIn();
  const user = getCurrentUser();

  el.innerHTML = `
    <div class="container">
      <div class="hero">
        <h1>管理代码片段，<span>像呼吸一样自然</span></h1>
        <p>SnipFlow 是面向开发者的云端代码片段管理平台。<br>保存、组织、分享你的代码，30+ 语言语法高亮，免费开始使用。</p>
        <div class="hero-actions">
          ${isLogged
            ? `<a href="#" onclick="navigateTo('dashboard')" class="btn btn-primary btn-lg">📂 进入控制台</a>`
            : `<a href="#" onclick="navigateTo('register')" class="btn btn-primary btn-lg">🚀 免费注册 — 只需30秒</a>
               <a href="#" onclick="navigateTo('explore')" class="btn btn-outline btn-lg">👀 浏览公开片段</a>`
          }
        </div>
        ${isLogged ? `<p style="margin-top:16px;color:var(--text-dim);">👋 欢迎回来，${escapeHtml(user.displayName || user.username)}</p>` : ''}
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-num">⚡</div>
            <div class="hero-stat-label">秒级保存</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">🏷️</div>
            <div class="hero-stat-label">标签管理</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">🔗</div>
            <div class="hero-stat-label">一键分享</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">💰</div>
            <div class="hero-stat-label">Pro 仅 ¥19/月</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">🌍</div>
            <div class="hero-stat-label">云端同步</div>
          </div>
        </div>
      </div>

      <div class="features">
        <div class="feature-card">
          <div class="feature-icon">📝</div>
          <h3>保存代码片段</h3>
          <p>支持 30+ 编程语言，自动语法高亮，快速保存你的常用代码。告别翻历史记录找代码。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🏷️</div>
          <h3>标签分类管理</h3>
          <p>通过标签、编程语言和关键词搜索，秒级找到需要的片段。管理千段代码，不乱不慌。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔗</div>
          <h3>一键分享</h3>
          <p>生成分享链接，嵌入博客或文档。公开、私密、仅链接可见，三种模式灵活控制。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔀</div>
          <h3>Fork 与复用</h3>
          <p>发现好的代码直接 Fork 到自己的库，二次修改使用。社区的力量在这里体现。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>AI 智能命名（Pro）</h3>
          <p>自动为你的代码生成标题和描述，粘贴即完成整理。省时省力，专注编码。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">👥</div>
          <h3>团队协作（Pro）</h3>
          <p>邀请团队成员共享代码库，统一规范，提升协作效率。告别微信传代码。</p>
        </div>
      </div>
    </div>
  `;
}

// ===== 探索页 =====
async function renderExplore() {
  const el = document.getElementById('mainContent');
  el.innerHTML = '<div class="container"><div class="loading">加载公开片段</div></div>';

  try {
    const data = await API.get('/snippets/explore');
    const tagsData = await API.get('/snippets/tags/popular');

    const snippets = data.snippets || [];
    const tags = tagsData.tags || [];

    el.innerHTML = `
      <div class="container">
        <div class="page-header">
          <h2>🌍 探索公开片段</h2>
        </div>

        <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;">
          ${tags.slice(0, 15).map(t => `<span class="snippet-tag" style="cursor:pointer;" onclick="filterByTag('${t.name}')">${escapeHtml(t.name)} (${t.count})</span>`).join('')}
        </div>

        ${snippets.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>还没有公开片段</h3>
            <p>成为第一个分享代码的人吧！</p>
          </div>
        ` : `
          <div class="snippet-grid">
            ${snippets.map(renderSnippetCard).join('')}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    el.innerHTML = '<div class="container"><div class="empty-state"><div class="empty-icon">😕</div><h3>加载失败</h3><p>请稍后再试</p></div></div>';
  }
}

// ===== 登录页 =====
function renderLogin() {
  const el = document.getElementById('mainContent');
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>👋 欢迎回来</h2>
        <p class="auth-subtitle">登录你的 SnipFlow 账号</p>
        <form onsubmit="handleLogin(event)">
          <div class="form-group">
            <input type="text" id="loginEmail" class="form-input" placeholder="邮箱或用户名" required>
          </div>
          <div class="form-group">
            <input type="password" id="loginPassword" class="form-input" placeholder="密码" required>
          </div>
          <div id="loginError" class="form-error"></div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;">登录</button>
          <p class="form-link">还没有账号？<a href="#" onclick="navigateTo('register')">立即注册</a></p>
        </form>
      </div>
    </div>
  `;
}

// ===== 注册页 =====
function renderRegister() {
  const el = document.getElementById('mainContent');
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h2>🚀 加入 SnipFlow</h2>
        <p class="auth-subtitle">免费注册，立即开始管理你的代码</p>
        <form onsubmit="handleRegister(event)">
          <div class="form-group">
            <input type="text" id="regUsername" class="form-input" placeholder="用户名" required>
          </div>
          <div class="form-group">
            <input type="email" id="regEmail" class="form-input" placeholder="邮箱" required>
          </div>
          <div class="form-group">
            <input type="password" id="regPassword" class="form-input" placeholder="密码（至少6位）" required minlength="6">
          </div>
          <div class="form-group">
            <input type="text" id="regDisplayName" class="form-input" placeholder="显示名称（可选）">
          </div>
          <div id="regError" class="form-error"></div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;">注册</button>
          <p class="form-link">已有账号？<a href="#" onclick="navigateTo('login')">登录</a></p>
        </form>
      </div>
    </div>
  `;
}

// ===== 定价页 =====
function renderPricing() {
  const el = document.getElementById('mainContent');
  const isLogged = isLoggedIn();

  el.innerHTML = `
    <div class="container">
      <div class="hero" style="padding-bottom:20px;">
        <h1>简单透明的 <span>定价</span></h1>
        <p>免费版足够日常使用，Pro 版解锁全部功能</p>
      </div>
      <div class="pricing-grid">
        <div class="pricing-card">
          <h3>Free</h3>
          <div class="pricing-price">¥0<span>/月</span></div>
          <ul class="pricing-features">
            <li>最多 50 个代码片段</li>
            <li>语法高亮</li>
            <li>标签分类</li>
            <li>搜索功能</li>
            <li>基础分享链接</li>
          </ul>
          ${isLogged
            ? `<a href="#" onclick="navigateTo('dashboard')" class="btn btn-outline" style="width:100%;justify-content:center;">当前使用中</a>`
            : `<a href="#" onclick="navigateTo('register')" class="btn btn-outline" style="width:100%;justify-content:center;">免费开始</a>`
          }
        </div>
        <div class="pricing-card highlighted">
          <h3>Pro</h3>
          <div class="pricing-price">¥19<span>/月</span></div>
          <ul class="pricing-features">
            <li>无限代码片段</li>
            <li>AI 智能命名与描述</li>
            <li>团队协作（最多5人）</li>
            <li>完整 API 访问</li>
            <li>批量导入/导出</li>
            <li>自定义分享品牌</li>
            <li>优先支持</li>
          </ul>
          ${isLogged
            ? `<button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="upgradeToPro()">🚀 升级 Pro</button>`
            : `<a href="#" onclick="navigateTo('register')" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;">注册升级</a>`
          }
        </div>
      </div>
    </div>
  `;
}

// 升级 Pro
async function upgradeToPro() {
  try {
    const data = await API.post('/payments/subscribe', { planId: 'pro' }, true);
    showToast(data.message || '🎉 升级成功！', 'success');
    // 更新本地用户信息
    const user = getCurrentUser();
    if (user) {
      user.plan = 'pro';
      localStorage.setItem('snipflow_user', JSON.stringify(user));
    }
    navigateTo('dashboard');
  } catch (err) {
    showToast(err.error || '升级失败', 'error');
  }
}

// ===== 控制台 =====
async function renderDashboard() {
  if (!isLoggedIn()) {
    navigateTo('login');
    return;
  }

  const el = document.getElementById('mainContent');
  el.innerHTML = '<div class="container"><div class="loading">加载中</div></div>';

  try {
    const [userData, snippetsData] = await Promise.all([
      API.get('/users/me', true),
      API.get('/snippets', true),
    ]);

    const user = userData.user;
    const stats = userData.stats || {};
    const snippets = snippetsData.snippets || [];

    el.innerHTML = `
      <div class="container">
        <div class="dashboard-layout">
          <div class="dashboard-sidebar">
            <div style="text-align:center;margin-bottom:16px;">
              <div style="width:48px;height:48px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-weight:600;font-size:1.1rem;color:#fff;">
                ${getInitials(user.displayName || user.username)}
              </div>
              <div style="color:var(--text-bright);font-weight:600;">${escapeHtml(user.displayName || user.username)}</div>
              <div><span class="plan-badge ${user.plan}">${user.plan === 'pro' ? '🌟 Pro' : 'Free'}</span></div>
            </div>
            <hr style="border-color:var(--border);margin:12px 0;">
            <div style="font-size:.82rem;color:var(--text-dim);">
              <div style="display:flex;justify-content:space-between;padding:4px 0;">
                <span>📦 片段</span><span>${stats.snippet_count || 0}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;">
                <span>👁 浏览</span><span>${stats.total_views || 0}</span>
              </div>
              ${user.plan === 'free' ? `
                <div style="display:flex;justify-content:space-between;padding:4px 0;color:${(stats.snippet_count || 0) >= 40 ? 'var(--warning)' : 'var(--text-dim)'};">
                  <span>📊 限额</span><span>${stats.snippet_count || 0}/50</span>
                </div>
              ` : ''}
            </div>
            ${user.plan === 'free' ? `
              <hr style="border-color:var(--border);margin:12px 0;">
              <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;" onclick="navigateTo('pricing')">🌟 升级 Pro</button>
            ` : ''}
          </div>
          <div class="dashboard-main">
            <div class="page-title-bar">
              <h2>我的代码片段</h2>
              <button class="btn btn-primary" onclick="openEditor()">✏️ 新建</button>
            </div>

            ${snippets.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>还没有代码片段</h3>
                <p>点击"新建"开始保存你的第一个代码片段吧！</p>
                <button class="btn btn-primary" onclick="openEditor()">✏️ 写第一个片段</button>
              </div>
            ` : `
              <div class="snippet-grid">
                ${snippets.map(s => renderSnippetCard(s)).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    if (err.status === 401) {
      logout();
      navigateTo('login');
    } else {
      el.innerHTML = '<div class="container"><div class="empty-state"><div class="empty-icon">😕</div><h3>加载失败</h3><p>请稍后再试</p></div></div>';
    }
  }
}

// ===== 分享页面 =====
async function renderSharedSnippet(code) {
  const el = document.getElementById('mainContent');
  el.innerHTML = '<div class="container"><div class="loading">加载分享内容</div></div>';

  try {
    const data = await API.get(`/snippets/share/${code}`);
    const s = data.snippet;

    el.innerHTML = `
      <div class="container">
        <div style="text-align:center;margin-bottom:16px;color:var(--text-dim);font-size:.85rem;">
          🔗 这是一个分享的代码片段
        </div>
        <div class="snippet-detail">
          <div class="snippet-detail-header">
            <h2 style="color:var(--text-bright);font-size:1.3rem;margin-bottom:8px;">${escapeHtml(s.title)}</h2>
            ${s.description ? `<p style="color:var(--text-dim);margin-bottom:12px;">${escapeHtml(s.description)}</p>` : ''}
            <div class="snippet-tags" style="margin-bottom:8px;">
              <span class="snippet-lang">${s.language}</span>
              ${s.tags.map(t => `<span class="snippet-tag">${escapeHtml(t.name)}</span>`).join('')}
            </div>
          </div>
          <div class="snippet-code-block">
            <pre><code class="language-${s.language}">${highlightCode(s.code, s.language)}</code></pre>
          </div>
          <div class="snippet-detail-actions">
            ${isLoggedIn() ? `<button class="btn btn-sm btn-outline" onclick="forkSnippet('${s.id}')">🔀 Fork 到我的库</button>` : ''}
          </div>
        </div>
      </div>
    `;

    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
  } catch (err) {
    el.innerHTML = `
      <div class="container">
        <div class="empty-state">
          <div class="empty-icon">🔗</div>
          <h3>分享链接无效</h3>
          <p>${err.error || '该分享链接不存在或已过期'}</p>
        </div>
      </div>
    `;
  }
}

// ===== 工具函数 =====
function filterByTag(tag) {
  navigateTo('explore');
}

function toggleMobileMenu() {
  const links = document.querySelector('.nav-links');
  const actions = document.querySelector('.nav-actions');
  links.classList.toggle('open');
  actions.classList.toggle('open');
}

// ===== 初始化 =====
window.addEventListener('DOMContentLoaded', () => {
  updateNav();

  // 处理 hash 路由
  const hash = window.location.hash.slice(1);
  if (hash) {
    renderPage(hash);
  } else {
    renderHome();
  }
});

// 监听 hash 变化
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1);
  renderPage(hash);
});