/**
 * SnipFlow - 认证模块
 */

// 检查登录状态
function isLoggedIn() {
  return !!localStorage.getItem('snipflow_token');
}

function getCurrentUser() {
  const user = localStorage.getItem('snipflow_user');
  return user ? JSON.parse(user) : null;
}

function updateNav() {
  const guestNav = document.getElementById('guestNav');
  const authNav = document.getElementById('authNav');
  const authNavLinks = document.getElementById('authNavLinks');

  if (isLoggedIn()) {
    guestNav.style.display = 'none';
    authNav.style.display = 'flex';
    authNavLinks.style.display = 'flex';
  } else {
    guestNav.style.display = 'flex';
    authNav.style.display = 'none';
    authNavLinks.style.display = 'none';
  }
}

// 注册
async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const displayName = document.getElementById('regDisplayName').value.trim() || username;
  const errorEl = document.getElementById('regError');

  try {
    const data = await API.post('/users/register', { username, email, password, displayName });
    localStorage.setItem('snipflow_token', data.token);
    localStorage.setItem('snipflow_user', JSON.stringify(data.user));
    updateNav();
    showToast('🎉 注册成功！', 'success');
    navigateTo('dashboard');
  } catch (err) {
    errorEl.textContent = err.error || '注册失败';
  }
}

// 登录
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    const data = await API.post('/users/login', { email, password });
    localStorage.setItem('snipflow_token', data.token);
    localStorage.setItem('snipflow_user', JSON.stringify(data.user));
    updateNav();
    showToast('👋 欢迎回来！', 'success');
    navigateTo('dashboard');
  } catch (err) {
    errorEl.textContent = err.error || '登录失败';
  }
}

// 退出登录
function logout() {
  localStorage.removeItem('snipflow_token');
  localStorage.removeItem('snipflow_user');
  updateNav();
  showToast('已退出登录', 'info');
  navigateTo('');
}