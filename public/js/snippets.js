/**
 * SnipFlow - 代码片段 UI 模块
 */

let currentEditUuid = null;

// 打开编辑器（新建或编辑）
async function openEditor(snippet = null) {
  document.getElementById('editorModal').style.display = 'flex';
  const titleEl = document.getElementById('editorTitle');
  const saveBtn = document.getElementById('saveBtn');

  // 加载语言列表
  const langSelect = document.getElementById('snippetLanguage');
  if (langSelect.options.length === 0) {
    const langs = await loadLanguages();
    langs.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = l;
      langSelect.appendChild(opt);
    });
  }

  if (snippet) {
    currentEditUuid = snippet.uuid || snippet.id;
    titleEl.textContent = '编辑代码片段';
    saveBtn.textContent = '更新';
    document.getElementById('snippetTitle').value = snippet.title || '';
    document.getElementById('snippetCode').value = snippet.code || '';
    document.getElementById('snippetLanguage').value = snippet.language || 'plaintext';
    document.getElementById('snippetTags').value = (snippet.tags || []).map(t => t.name).join(', ');
    document.getElementById('snippetVisibility').value = snippet.visibility || 'private';
    document.getElementById('snippetDescription').value = snippet.description || '';
  } else {
    currentEditUuid = null;
    titleEl.textContent = '新建代码片段';
    saveBtn.textContent = '保存';
    document.getElementById('snippetTitle').value = '';
    document.getElementById('snippetCode').value = '';
    document.getElementById('snippetLanguage').value = 'javascript';
    document.getElementById('snippetTags').value = '';
    document.getElementById('snippetVisibility').value = 'private';
    document.getElementById('snippetDescription').value = '';
  }

  // 聚焦到代码编辑区
  setTimeout(() => document.getElementById('snippetCode').focus(), 100);
}

function closeEditor() {
  document.getElementById('editorModal').style.display = 'none';
  currentEditUuid = null;
}

// 保存片段
async function saveSnippet() {
  const data = {
    title: document.getElementById('snippetTitle').value.trim(),
    code: document.getElementById('snippetCode').value,
    language: document.getElementById('snippetLanguage').value,
    tags: document.getElementById('snippetTags').value.split(',').map(t => t.trim()).filter(Boolean),
    visibility: document.getElementById('snippetVisibility').value,
    description: document.getElementById('snippetDescription').value.trim(),
  };

  if (!data.code) {
    showToast('代码内容不能为空', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中…';

  try {
    if (currentEditUuid) {
      await API.put(`/snippets/${currentEditUuid}`, data, true);
      showToast('✅ 已更新', 'success');
    } else {
      await API.post('/snippets', data, true);
      showToast('✅ 已保存', 'success');
    }
    closeEditor();
    // 刷新当前视图
    const page = getCurrentPage();
    if (page === 'dashboard') renderDashboard();
    else renderPage(page);
  } catch (err) {
    showToast(err.error || '保存失败', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = currentEditUuid ? '更新' : '保存';
  }
}

// 删除片段
async function deleteSnippet(uuid) {
  if (!confirm('确定删除这个代码片段吗？此操作不可恢复。')) return;

  try {
    await API.delete(`/snippets/${uuid}`, true);
    showToast('🗑️ 已删除', 'success');
    renderDashboard();
  } catch (err) {
    showToast(err.error || '删除失败', 'error');
  }
}

// 切换收藏
async function toggleFavorite(uuid) {
  try {
    await API.post(`/snippets/${uuid}/like`, {}, true);
    renderSnippetDetail(uuid);
  } catch (err) {
    showToast(err.error || '操作失败', 'error');
  }
}

// Fork 片段
async function forkSnippet(uuid) {
  try {
    const data = await API.post(`/snippets/${uuid}/fork`, {}, true);
    showToast('🔀 Fork 成功！已保存到你的片段库', 'success');
    navigateTo('dashboard');
  } catch (err) {
    showToast(err.error || 'Fork 失败', 'error');
  }
}

// 渲染片段卡片
function renderSnippetCard(snippet) {
  const preview = (snippet.code || '').slice(0, 200);
  const tags = snippet.tags || [];

  return `
    <div class="snippet-card" onclick="navigateTo('snippet/${snippet.id}')">
      <div class="snippet-header">
        <div>
          <div class="snippet-title">${escapeHtml(snippet.title)}</div>
          <span class="snippet-lang">${snippet.language}</span>
        </div>
        <div>
          ${snippet.visibility === 'public' ? '🌍' : snippet.visibility === 'unlisted' ? '🔗' : '🔒'}
        </div>
      </div>
      <div class="snippet-preview">${escapeHtml(preview)}</div>
      <div class="snippet-footer">
        <div class="snippet-tags">
          ${tags.slice(0, 3).map(t => `<span class="snippet-tag">${escapeHtml(t.name)}</span>`).join('')}
        </div>
        <div class="snippet-meta">
          <span>👁 ${snippet.views || 0}</span>
          <span>❤ ${snippet.likeCount || 0}</span>
          <span>${timeAgo(snippet.createdAt)}</span>
        </div>
      </div>
    </div>
  `;
}

// 渲染片段详情
async function renderSnippetDetail(uuid) {
  const el = document.getElementById('mainContent');
  el.innerHTML = '<div class="loading">加载中</div>';

  try {
    const data = await API.get(`/snippets/${uuid}`, isLoggedIn());
    const s = data.snippet;
    const author = s.author || {};

    const canEdit = isLoggedIn() && getCurrentUser()?.id === s.userId;

    el.innerHTML = `
      <div class="container">
        <a href="#" onclick="history.back(); return false;" style="display:inline-block;margin-bottom:16px;color:var(--text-dim);">&larr; 返回</a>
        <div class="snippet-detail">
          <div class="snippet-detail-header">
            <div class="snippet-author">
              <div class="snippet-author-avatar">${getInitials(author.displayName || author.username)}</div>
              <div class="snippet-author-info">
                <div class="snippet-author-name">${escapeHtml(author.displayName || author.username)}</div>
                <div class="snippet-author-date">${timeAgo(s.createdAt)} · ${s.language}</div>
              </div>
            </div>
            <h2 style="color:var(--text-bright);font-size:1.3rem;margin-bottom:8px;">${escapeHtml(s.title)}</h2>
            ${s.description ? `<p style="color:var(--text-dim);margin-bottom:12px;">${escapeHtml(s.description)}</p>` : ''}
            <div class="snippet-tags" style="margin-bottom:12px;">
              ${s.tags.map(t => `<span class="snippet-tag">${escapeHtml(t.name)}</span>`).join('')}
              <span style="margin-left:8px;font-size:.78rem;color:var(--text-dim);">
                👁 ${s.views} · ❤ ${s.likeCount}
              </span>
            </div>
          </div>
          <div class="snippet-code-block">
            <pre><code class="language-${s.language}">${highlightCode(s.code, s.language)}</code></pre>
          </div>
          <div class="snippet-detail-actions">
            ${canEdit ? `
              <button class="btn btn-sm btn-outline" onclick="openEditor(${JSON.stringify(s).replace(/"/g, "'")})">✏️ 编辑</button>
              <button class="btn btn-sm btn-danger" onclick="deleteSnippet('${s.id}')">🗑️ 删除</button>
            ` : `
              <button class="btn btn-sm btn-outline" onclick="forkSnippet('${s.id}')">🔀 Fork</button>
            `}
            ${canEdit ? `
              <button class="btn btn-sm btn-outline" onclick="copyShareLink('${s.id}')">🔗 分享</button>
            ` : ''}
            <button class="btn btn-sm btn-outline" onclick="copyCode('${s.id}')" id="copyBtn-${s.id}">📋 复制代码</button>
          </div>
        </div>
      </div>
    `;

    // 高亮渲染
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
  } catch (err) {
    el.innerHTML = `
      <div class="container">
        <div class="empty-state">
          <div class="empty-icon">😕</div>
          <h3>片段不存在</h3>
          <p>${err.error || '无法加载这个代码片段'}</p>
        </div>
      </div>
    `;
  }
}

// 复制代码
async function copyCode(uuid) {
  try {
    const data = await API.get(`/snippets/${uuid}`, isLoggedIn());
    await navigator.clipboard.writeText(data.snippet.code);
    const btn = document.getElementById(`copyBtn-${uuid}`);
    if (btn) { btn.textContent = '✅ 已复制'; setTimeout(() => btn.textContent = '📋 复制代码', 2000); }
    showToast('📋 已复制到剪贴板', 'success');
  } catch {
    showToast('复制失败', 'error');
  }
}

// 生成分享链接
async function copyShareLink(uuid) {
  try {
    const data = await API.post(`/snippets/${uuid}/share`, {}, true);
    const url = `${window.location.origin}/share/${data.shareCode}`;
    await navigator.clipboard.writeText(url);
    showToast('🔗 分享链接已复制', 'success');
  } catch (err) {
    showToast(err.error || '生成分享链接失败', 'error');
  }
}