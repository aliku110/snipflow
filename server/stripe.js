/**
 * SnipFlow - Stripe 支付集成
 * 
 * 使用方法:
 * 1. 在 Stripe 官网注册账号 https://stripe.com
 * 2. 获取 API 密钥 (pk_... 和 sk_...)
 * 3. 在 .env 中填入密钥
 * 4. 重启服务即可激活真实支付
 */
const stripeAvailable = !!process.env.STRIPE_SECRET_KEY;

let stripe = null;

if (stripeAvailable) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('[Stripe] ✅  Stripe 支付已激活');
  } catch (err) {
    console.log('[Stripe] ⚠️  Stripe 初始化失败:', err.message);
  }
}

/**
 * 创建 Stripe Checkout Session
 */
async function createCheckoutSession(user, priceId, successUrl, cancelUrl) {
  if (!stripe) {
    throw new Error('Stripe 未配置');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    customer_email: user.email,
    client_reference_id: String(user.id),
    metadata: {
      userId: String(user.id),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        userId: String(user.id),
      },
    },
  });

  return session;
}

/**
 * 处理 Stripe Webhook 事件
 */
async function handleWebhookEvent(event) {
  const { get, run } = require('../db');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = parseInt(session.metadata.userId);
      if (userId) {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        run("UPDATE users SET plan = 'pro', stripe_customer_id = ?, stripe_subscription_id = ?, subscription_ends_at = ? WHERE id = ?",
          [session.customer, session.subscription, endDate.toISOString(), userId]);
        console.log(`[Stripe] 用户 ${userId} 订阅成功`);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        const userId = parseInt(subscription.metadata.userId);
        if (userId) {
          run("UPDATE users SET plan = 'free' WHERE id = ?", [userId]);
          console.log(`[Stripe] 用户 ${userId} 订阅已取消`);
        }
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        // 续费成功，延长有效期
        // 由 Stripe 的 billing_cycle_anchor 自动处理
        console.log(`[Stripe] 续费成功: ${invoice.id}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object;
      console.log(`[Stripe] 续费失败: ${failedInvoice.id}`);
      break;
    }
  }
}

module.exports = {
  stripe,
  stripeAvailable,
  createCheckoutSession,
  handleWebhookEvent,
};