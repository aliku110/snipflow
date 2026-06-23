/**
 * SnipFlow - 支付/订阅路由 (Stripe + Demo 双模式)
 */
const express = require('express');
const { get, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { stripe, stripeAvailable, createCheckoutSession, handleWebhookEvent } = require('../stripe');

const router = express.Router();

// ===== 定价信息 =====
router.get('/pricing', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'CNY',
        period: 'month',
        description: '适合个人开发者起步',
        features: [
          '最多 50 个代码片段',
          '语法高亮 (30+ 语言)',
          '标签分类管理',
          '全文搜索',
          '基础分享链接',
        ],
        highlighted: false,
        cta: '免费开始',
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 19,
        currency: 'CNY',
        period: 'month',
        description: '解锁全部功能，无限创作',
        features: [
          '无限代码片段',
          'AI 智能命名与描述',
          '团队协作 (最多5人)',
          'REST API 完整访问',
          '批量导入/导出',
          '自定义分享品牌',
          '优先技术支持',
          '🚀 新功能抢先体验',
        ],
        highlighted: true,
        cta: '升级 Pro',
      },
    ],
    paymentProvider: stripeAvailable ? 'stripe' : 'demo',
    // Stripe 的 Price ID (在 Stripe Dashboard 创建)
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || null,
  });
});

// ===== 创建订阅 (Stripe Checkout / Demo) =====
router.post('/subscribe', authenticateToken, async (req, res) => {
  const { planId } = req.body;
  if (planId !== 'pro') return res.status(400).json({ error: '仅支持 Pro 计划订阅' });

  const user = get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.plan === 'pro') return res.json({ message: '您已经是 Pro 用户', plan: 'pro' });

  // === Stripe 模式 ===
  if (stripeAvailable && process.env.STRIPE_PRICE_PRO_MONTHLY) {
    try {
      const origin = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
      const session = await createCheckoutSession(
        user,
        process.env.STRIPE_PRICE_PRO_MONTHLY,
        `${origin}/dashboard?subscribe=success`,
        `${origin}/pricing?subscribe=cancel`
      );
      return res.json({ checkoutUrl: session.url, mode: 'stripe' });
    } catch (err) {
      console.error('[Stripe Checkout Error]', err);
      return res.status(500).json({ error: '支付初始化失败，请稍后再试' });
    }
  }

  // === Demo 模式 (无 Stripe Key) ===
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  run("UPDATE users SET plan = 'pro', subscription_ends_at = ? WHERE id = ?",
    [endDate.toISOString(), req.user.userId]);

  return res.json({
    message: '🎉 恭喜升级 Pro！（Demo 模式，30天后自动降级）',
    plan: 'pro',
    subscriptionEndsAt: endDate.toISOString(),
    isDemo: true,
  });
});

// ===== 取消订阅 =====
router.post('/cancel', authenticateToken, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.plan !== 'pro') return res.status(400).json({ error: '您当前不是 Pro 用户' });

  // Stripe 模式：取消 Stripe 订阅
  if (stripeAvailable && process.env.STRIPE_SECRET_KEY && user.stripe_subscription_id) {
    try {
      stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      console.error('[Stripe Cancel Error]', err);
    }
  }

  run("UPDATE users SET plan = 'free', subscription_ends_at = NULL WHERE id = ?", [req.user.userId]);
  res.json({ message: '已取消 Pro 订阅', plan: 'free' });
});

// ===== 订阅状态 =====
router.get('/status', authenticateToken, (req, res) => {
  const user = get('SELECT plan, subscription_ends_at, stripe_subscription_id FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  let daysRemaining = null;
  if (user.subscription_ends_at) {
    const diff = new Date(user.subscription_ends_at) - new Date();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  res.json({
    plan: user.plan,
    subscriptionEndsAt: user.subscription_ends_at,
    daysRemaining,
    isActive: user.plan === 'pro' && daysRemaining !== 0,
  });
});

// ===== Stripe Webhook (关键：接收 Stripe 事件) =====
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // 快速返回 200，避免 Stripe 重试
  res.json({ received: true });

  // 异步处理事件
  if (stripeAvailable) {
    try {
      const sig = req.headers['stripe-signature'];
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('[Stripe Webhook] 签名验证失败:', err.message);
        return;
      }
      await handleWebhookEvent(event);
    } catch (err) {
      console.error('[Stripe Webhook Error]', err);
    }
  }
});

// ===== 创建 Stripe Portal Session (管理订阅) =====
router.post('/portal', authenticateToken, async (req, res) => {
  if (!stripeAvailable || !process.env.STRIPE_SECRET_KEY) {
    return res.status(400).json({ error: 'Stripe 未配置' });
  }

  const user = get('SELECT stripe_customer_id FROM users WHERE id = ?', [req.user.userId]);
  if (!user || !user.stripe_customer_id) {
    return res.status(400).json({ error: '没有找到 Stripe 客户信息' });
  }

  try {
    const origin = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });
    res.json({ portalUrl: portalSession.url });
  } catch (err) {
    console.error('[Stripe Portal Error]', err);
    res.status(500).json({ error: '无法打开管理页面' });
  }
});

module.exports = router;