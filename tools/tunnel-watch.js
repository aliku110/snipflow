/**
 * SnipFlow - 隧道保活脚本 (Node.js)
 * 监控 localtunnel 连接，断线自动重连
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TUNNEL_SUBDOMAIN = 'snipflow';
const CHECK_INTERVAL = 30000; // 30秒检查一次
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const TUNNEL_URL = `https://${TUNNEL_SUBDOMAIN}.loca.lt`;

let tunnelProcess = null;
let lastUrl = null;

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

/**
 * 检查本地服务是否存活
 */
function checkLocalHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

/**
 * 启动/重启隧道
 */
function startTunnel() {
  if (tunnelProcess) {
    log('🔄 关闭旧隧道...');
    tunnelProcess.kill();
    tunnelProcess = null;
  }

  log(`🚇 启动隧道 -> ${TUNNEL_URL}`);
  
  const npxCmd = process.platform === 'win32' ? 'D:\\nodejs\\npx.cmd' : 'npx';
  tunnelProcess = spawn(npxCmd, ['localtunnel', '--port', String(PORT), '--subdomain', TUNNEL_SUBDOMAIN], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  tunnelProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log(`📡 ${output}`);
      if (output.includes('your url is:')) {
        lastUrl = output.split('your url is: ')[1]?.trim() || lastUrl;
        log(`✅ 隧道已上线: ${lastUrl || TUNNEL_URL}`);
      }
    }
  });

  tunnelProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log(`⚠️ ${output}`);
  });

  tunnelProcess.on('exit', (code, signal) => {
    log(`💀 隧道进程退出 (code=${code}, signal=${signal})`);
    tunnelProcess = null;
    // 5秒后自动重启
    setTimeout(startTunnel, 5000);
  });
}

/**
 * 定期检查隧道状态
 */
async function checkTunnel() {
  const localOk = await checkLocalHealth();
  if (!localOk) {
    log('⚠️ 本地服务不可用，等待中...');
    return;
  }

  // 检查隧道进程是否存在
  if (!tunnelProcess) {
    log('⚠️ 隧道进程已终止，重新启动...');
    startTunnel();
    return;
  }

  // 尝试访问公开URL
  try {
    await new Promise((resolve, reject) => {
      const url = new URL(TUNNEL_URL);
      const req = http.get({ hostname: url.hostname, path: '/api/health', method: 'GET', timeout: 10000 }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
    log(`✅ 隧道正常 [${TUNNEL_URL}/api/health]`);
  } catch (err) {
    log(`⚠️ 隧道可能已断开 (${err.message}), 重启中...`);
    startTunnel();
  }
}

// ===== 启动 =====
log('═══════════════════════════════════════');
log('  SnipFlow 隧道守护程序 v1.0');
log(`  本地端口: ${PORT}`);
log(`  隧道地址: ${TUNNEL_URL}`);
log('═══════════════════════════════════════');

startTunnel();

// 定期检查
setInterval(checkTunnel, CHECK_INTERVAL);

// 优雅退出
process.on('SIGINT', () => {
  log('🛑 收到退出信号，清理中...');
  if (tunnelProcess) tunnelProcess.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('🛑 收到终止信号');
  if (tunnelProcess) tunnelProcess.kill();
  process.exit(0);
});