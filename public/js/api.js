/**
 * SnipFlow - API 客户端
 */
const API = {
  BASE: '/api',

  async request(method, path, data, auth = false) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (auth) {
      const token = localStorage.getItem('snipflow_token');
      if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && method !== 'GET') {
      opts.body = JSON.stringify(data);
    }

    const res = await fetch(`${this.BASE}${path}`, opts);
    const json = await res.json();

    if (!res.ok) {
      throw { status: res.status, ...json };
    }

    return json;
  },

  get(path, auth = false) { return this.request('GET', path, null, auth); },
  post(path, data = {}, auth = false) { return this.request('POST', path, data, auth); },
  put(path, data = {}, auth = false) { return this.request('PUT', path, data, auth); },
  delete(path, auth = false) { return this.request('DELETE', path, null, auth); },
};

/**
 * 显示通知
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * 格式化时间
 */
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  return date.toLocaleDateString('zh-CN');
}

/**
 * Logo 头像
 */
function getInitials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

/**
 * 高亮代码
 */
function highlightCode(code, lang) {
  if (!code) return '';
  try {
    const validLang = lang && lang !== 'plaintext' ? lang : 'plaintext';
    if (typeof hljs !== 'undefined') {
      const result = hljs.highlight(code, { language: validLang, ignoreIllegals: true });
      return result.value;
    }
  } catch (e) {}
  return escapeHtml(code);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 加载语言列表
 */
async function loadLanguages() {
  try {
    const data = await API.get('/snippets/languages');
    return data.languages;
  } catch {
    return ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'plaintext'];
  }
}