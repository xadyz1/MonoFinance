require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5001;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: (process.env.SMTP_PORT || '587') === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'swiftfinance_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30*24*60*60*1000, sameSite: 'lax', httpOnly: true }
}));
app.use((req, res, next) => { res.set('Cache-Control', 'no-cache,no-store,must-revalidate'); next(); });

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Não autenticado' });
  next();
};

const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Não autenticado' });
  const { data: u } = await supabase.from('swiftfinance_users').select('role').eq('id', req.session.userId).single();
  if (!u || u.role !== 'admin') return res.status(403).json({ message: 'Sem permissão' });
  next();
};

async function getUserData(userId) {
  const { data: row } = await supabase.from('swiftfinance_user_data').select('*').eq('user_id', userId).single();
  if (!row) {
    const defaults = {
      user_id: userId,
      transactions: [],
      savings_target: 10000,
      recurring_expenses: [],
      savings_goals: [],
      daily_expense_limit: 1000,
      weekly_expense_limit: 7000,
      monthly_expense_limit: 30000,
      expense_limit_period: 'day'
    };
    await supabase.from('swiftfinance_user_data').insert(defaults);
    return defaults;
  }
  return row;
}

async function sendOneSignalNotification(userIds, heading, content, url) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_API_KEY) return;
  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_external_user_ids: userIds,
        headings: { en: heading, pt: heading },
        contents: { en: content, pt: content },
        url
      })
    });
  } catch (e) { console.error('OneSignal error', e); }
}

async function sendEmail(to, subject, html) {
  if (!transporter) return;
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
  } catch (e) { console.error('SMTP error', e); }
}

function buildEmailTemplate(title, message, details, actionUrl, actionLabel, recipientName) {
  const logoUrl = process.env.APP_URL ? `${process.env.APP_URL}/darkswiftfinance.png` : '/darkswiftfinance.png';
  const appUrl = process.env.APP_URL || '/';
  let detailRows = '';
  if (details && details.length) {
    detailRows = details.map(d => `<tr><td style="padding:8px 18px;font-size:14px;line-height:21px;color:#5b665f;font-family:Arial,sans-serif;"><strong style="color:#26332a;">${d.label}</strong><br>${d.value}</td></tr>`).join('');
  }
  const html = fs.readFileSync(path.join(__dirname, 'swiftfinance-email-template.html'), 'utf8');
  return html
    .replace(/\{\{logo_url\}\}/g, logoUrl)
    .replace(/\{\{app_url\}\}/g, appUrl)
    .replace(/\{\{action_url\}\}/g, actionUrl || appUrl)
    .replace(/\{\{action_label\}\}/g, actionLabel || 'Abrir SwiftFinance')
    .replace(/\{\{subject\}\}/g, title)
    .replace(/\{\{preheader\}\}/g, title)
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{recipient_name\}\}/g, recipientName || 'Utilizador')
    .replace(/\{\{message\}\}/g, message)
    .replace(/\{\{detail_label_1\}\}/g, details?.[0]?.label || '')
    .replace(/\{\{detail_value_1\}\}/g, details?.[0]?.value || '')
    .replace(/\{\{detail_label_2\}\}/g, details?.[1]?.label || '')
    .replace(/\{\{detail_value_2\}\}/g, details?.[1]?.value || '')
    .replace(/\{\{detail_label_3\}\}/g, details?.[2]?.label || '')
    .replace(/\{\{detail_value_3\}\}/g, details?.[2]?.value || '')
    .replace(/\{\{detail_label_4\}\}/g, details?.[3]?.label || '')
    .replace(/\{\{detail_value_4\}\}/g, details?.[3]?.value || '')
    .replace(/<table role="presentation" class="details"[^>]*>[\s\S]*?<\/table>/,
      details && details.length ? `<table role="presentation" class="details" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;background:#f7f9f7;border:1px solid #edf0ed;border-radius:8px;">${detailRows}</table>` : '');
}

// Auth
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Obrigatório' });
  const { data: existing } = await supabase.from('swiftfinance_users').select('id').ilike('email', username).single();
  if (existing) return res.status(409).json({ message: 'Já existe' });
  const { data: user, error } = await supabase.from('swiftfinance_users').insert({
    email: username.toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    role: 'user',
    name: username.split('@')[0]
  }).select().single();
  if (error || !user) return res.status(500).json({ message: 'Erro ao criar conta' });
  await getUserData(user.id);
  req.session.userId = user.id; req.session.username = user.email;
  res.json({ message: 'Conta criada', username: user.email });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Obrigatório' });
  const { data: u } = await supabase.from('swiftfinance_users').select('*').ilike('email', username).single();
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ message: 'Dados incorrectos' });
  req.session.userId = u.id; req.session.username = u.email;
  res.json({ message: 'OK', username: u.email, role: u.role });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ message: 'OK' }); });

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Não autenticado' });
  const { data: u } = await supabase.from('swiftfinance_users').select('email,role,name,avatar_url,plan_id').eq('id', req.session.userId).single();
  res.json({ username: req.session.username, role: u?.role || 'user', name: u?.name || '', avatar_url: u?.avatar_url || '', plan_id: u?.plan_id || null });
});

app.post('/api/change-password', requireAuth, async (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password || new_password.length < 4) return res.status(400).json({ message: 'Dados inválidos' });
  const { data: u } = await supabase.from('swiftfinance_users').select('password_hash').eq('id', req.session.userId).single();
  if (!u || !bcrypt.compareSync(old_password, u.password_hash)) return res.status(401).json({ message: 'Password incorreta' });
  await supabase.from('swiftfinance_users').update({ password_hash: bcrypt.hashSync(new_password, 10) }).eq('id', req.session.userId);
  res.json({ message: 'OK' });
});

app.post('/api/profile', requireAuth, async (req, res) => {
  const { name, avatar_url } = req.body || {};
  await supabase.from('swiftfinance_users').update({ name, avatar_url }).eq('id', req.session.userId);
  res.json({ message: 'OK' });
});

// Data
app.get('/api/data', requireAuth, async (req, res) => {
  const d = await getUserData(req.session.userId);
  res.json({
    transactions: d.transactions || [],
    savingsTarget: d.savings_target,
    recurringExpenses: d.recurring_expenses || [],
    savingsGoals: d.savings_goals || [],
    dailyExpenseLimit: d.daily_expense_limit,
    weeklyExpenseLimit: d.weekly_expense_limit,
    monthlyExpenseLimit: d.monthly_expense_limit,
    expenseLimitPeriod: d.expense_limit_period
  });
});

app.post('/api/data', requireAuth, async (req, res) => {
  const b = req.body || {};
  const payload = {
    transactions: b.transactions || [],
    savings_target: b.savingsTarget || 10000,
    recurring_expenses: b.recurringExpenses || [],
    savings_goals: b.savingsGoals || [],
    daily_expense_limit: b.dailyExpenseLimit || 1000,
    weekly_expense_limit: b.weeklyExpenseLimit || 7000,
    monthly_expense_limit: b.monthlyExpenseLimit || 30000,
    expense_limit_period: b.expenseLimitPeriod || 'day'
  };
  const { data: existing } = await supabase.from('swiftfinance_user_data').select('user_id').eq('user_id', req.session.userId).single();
  if (existing) await supabase.from('swiftfinance_user_data').update(payload).eq('user_id', req.session.userId);
  else await supabase.from('swiftfinance_user_data').insert({ user_id: req.session.userId, ...payload });
  res.json({ message: 'OK' });
});

// Receipts
app.post('/api/upload-receipt', requireAuth, async (req, res) => {
  const { file, name } = req.body || {};
  if (!file || !name || !process.env.BUNNY_STORAGE_ENDPOINT || !process.env.BUNNY_API_KEY) {
    return res.status(400).json({ message: 'Ficheiro ou configuração em falta' });
  }
  const buffer = Buffer.from(file.replace(/^data:.+;base64,/, ''), 'base64');
  const safeName = Date.now() + '_' + name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const url = `${process.env.BUNNY_STORAGE_ENDPOINT}/${safeName}`;
  try {
    const r = await fetch(url, { method: 'PUT', headers: { AccessKey: process.env.BUNNY_API_KEY, 'Content-Type': 'application/octet-stream' }, body: buffer });
    if (!r.ok) throw new Error('Bunny upload failed');
    const publicUrl = process.env.BUNNY_PULL_ZONE ? `${process.env.BUNNY_PULL_ZONE}/${safeName}` : url;
    const { data: rec } = await supabase.from('swiftfinance_receipts').insert({ user_id: req.session.userId, file_url: publicUrl, file_name: name }).select().single();
    res.json({ url: publicUrl, id: rec.id });
  } catch (e) { res.status(500).json({ message: 'Erro ao enviar ficheiro' }); }
});

app.get('/api/receipts/:transactionId', requireAuth, async (req, res) => {
  const { data } = await supabase.from('swiftfinance_receipts').select('*').eq('user_id', req.session.userId).eq('transaction_id', req.params.transactionId);
  res.json(data || []);
});

// Admin: Users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('swiftfinance_users').select('id,email,role,name,plan_id,created_at');
  res.json({ users: data || [] });
});

app.post('/api/admin/user', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Obrigatório' });
  const { data: existing } = await supabase.from('swiftfinance_users').select('id').ilike('email', username).single();
  if (existing) return res.status(409).json({ message: 'Já existe' });
  const { data: user } = await supabase.from('swiftfinance_users').insert({
    email: username.toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    role: role || 'user',
    name: username.split('@')[0]
  }).select().single();
  if (user) await getUserData(user.id);
  res.json({ message: 'OK' });
});

app.delete('/api/admin/user/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.session.userId) return res.status(400).json({ message: 'Não pode eliminar a si mesmo' });
  await supabase.from('swiftfinance_users').delete().eq('id', id);
  res.json({ message: 'OK' });
});

app.put('/api/admin/user/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Inválido' });
  await supabase.from('swiftfinance_users').update({ role }).eq('id', parseInt(req.params.id));
  res.json({ message: 'OK' });
});

// Plans
app.get('/api/plans', async (req, res) => {
  const { data } = await supabase.from('swiftfinance_plans').select('*').order('sort_order', { ascending: true });
  res.json({ plans: data || [] });
});

app.post('/api/admin/plans', requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.stripe_price_id) return res.status(400).json({ message: 'Nome e Stripe Price ID obrigatórios' });
  const { data, error } = await supabase.from('swiftfinance_plans').insert({
    name: b.name,
    description: b.description || '',
    price: b.price || 0,
    stripe_price_id: b.stripe_price_id,
    price_id: b.price_id || b.stripe_price_id,
    features: b.features || [],
    popular: b.popular || false,
    sort_order: b.sort_order || 0,
    active: b.active !== false
  }).select().single();
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

app.put('/api/admin/plans/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const { error } = await supabase.from('swiftfinance_plans').update({
    name: b.name,
    description: b.description,
    price: b.price,
    stripe_price_id: b.stripe_price_id,
    price_id: b.price_id || b.stripe_price_id,
    features: b.features,
    popular: b.popular,
    sort_order: b.sort_order,
    active: b.active
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ message: 'OK' });
});

app.delete('/api/admin/plans/:id', requireAdmin, async (req, res) => {
  await supabase.from('swiftfinance_plans').delete().eq('id', req.params.id);
  res.json({ message: 'OK' });
});

app.get('/api/admin/plans/:id', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('swiftfinance_plans').select('*').eq('id', req.params.id).single();
  if (!data) return res.status(404).json({ message: 'Não encontrado' });
  res.json(data);
});

// Stripe
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ message: 'Stripe não configurado' });
  const { priceId } = req.body || {};
  const { data: plan } = await supabase.from('swiftfinance_plans').select('*').eq('stripe_price_id', priceId).single();
  if (!plan) return res.status(404).json({ message: 'Plano não encontrado' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'http://localhost:5001'}/app.html?subscribed=1`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5001'}/`,
      client_reference_id: String(req.session.userId),
      metadata: { userId: String(req.session.userId), planId: String(plan.id) }
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/subscription', requireAuth, async (req, res) => {
  const { data: sub } = await supabase.from('swiftfinance_subscriptions')
    .select('*, swiftfinance_plans(*)').eq('user_id', req.session.userId).order('created_at', { ascending: false }).limit(1).single();
  res.json({ subscription: sub || null });
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(500).json({ message: 'Stripe webhook não configurado' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) { return res.status(400).json({ message: e.message }); }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = parseInt(s.client_reference_id || s.metadata?.userId);
    const planId = parseInt(s.metadata?.planId);
    if (userId && planId) {
      await supabase.from('swiftfinance_subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: s.subscription,
        status: 'active',
        current_period_end: new Date(Date.now() + 30*24*60*60*1000).toISOString()
      });
      await supabase.from('swiftfinance_users').update({ plan_id: planId }).eq('id', userId);
    }
  }
  if (event.type === 'invoice.payment_failed') {
    const s = event.data.object;
    await supabase.from('swiftfinance_subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', s.subscription);
  }
  res.json({ received: true });
});

// Admin: Advertising
app.get('/api/advertising', async (req, res) => {
  const { data } = await supabase.from('swiftfinance_advertising').select('*');
  const out = {};
  (data || []).forEach(a => out[a.slot_name] = a);
  res.json(out);
});

app.get('/api/ads', async (req, res) => {
  const { data } = await supabase.from('swiftfinance_advertising').select('*').eq('slot_name', req.query.slot || 'landing').eq('active', true).single();
  res.json(data || { html: '', active: false });
});

app.get('/api/admin/ads/:slot', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('swiftfinance_advertising').select('*').eq('slot_name', req.params.slot).single();
  res.json(data || { html: '', active: true });
});

app.post('/api/admin/ads', requireAdmin, async (req, res) => {
  const { slot_name, html, active } = req.body || {};
  if (!slot_name) return res.status(400).json({ message: 'Slot obrigatório' });
  const { data: existing } = await supabase.from('swiftfinance_advertising').select('id').eq('slot_name', slot_name).single();
  if (existing) {
    await supabase.from('swiftfinance_advertising').update({ html_code: html, active: active !== false }).eq('id', existing.id);
  } else {
    await supabase.from('swiftfinance_advertising').insert({ slot_name, html_code: html, active: active !== false });
  }
  res.json({ message: 'OK' });
});

// AI Categorize
app.post('/api/categorize', requireAuth, async (req, res) => {
  const { description, type } = req.body || {};
  const def = type === 'income' ? 'Outros rendimentos' : 'Outras despesas';
  const KEY = process.env.GROQ_API_KEY;
  if (!description || !KEY) return res.json({ category: def });
  const cats = type === 'income'
    ? ['Salário', 'Freelance e projetos', 'Prémios e gorjetas', 'Investimentos e cashback', 'Outros rendimentos']
    : ['Alimentação', 'Cafés e restaurantes', 'Transporte e automóvel', 'Habitação e utilidades', 'Saúde e desporto', 'Compras e vestuário', 'Lazer e entretenimento', 'Outras despesas'];
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: 'Return ONLY category from: ' + cats.join(', ') }, { role: 'user', content: '"' + description + '" ' + type }],
        temperature: 0.1, max_tokens: 30
      })
    });
    const d = await r.json();
    const c = (d.choices?.[0]?.message?.content || '').trim();
    res.json({ category: cats.includes(c) ? c : def });
  } catch (e) { res.json({ category: def }); }
});

// Voice
app.post('/api/voice-transcribe', requireAuth, async (req, res) => {
  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(500).json({ message: 'API key não configurada' });
  try {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    await new Promise(r => req.on('end', r));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const audio = Buffer.from(body.audio, 'base64');
    const fd = new FormData();
    fd.append('file', new Blob([audio], { type: 'audio/webm' }), 'audio.webm');
    fd.append('model', 'whisper-large-3');
    fd.append('language', 'pt');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + KEY }, body: fd });
    const d = await r.json();
    res.json({ text: d.text || '' });
  } catch (e) { res.status(500).json({ message: 'Erro ao transcrever' }); }
});

// Notifications & Cron
const UK_MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

async function checkLimitsAndNotify() {
  const { data: users } = await supabase.from('swiftfinance_users').select('id,email,name');
  for (const u of users || []) {
    const d = await getUserData(u.id);
    const txs = d.transactions || [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const dayExp = txs.filter(t => t.type === 'expense' && t.date === today).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const monthExp = txs.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === thisMonth && new Date(t.date).getFullYear() === thisYear).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const limit = d.expense_limit_period === 'day' ? d.daily_expense_limit : d.monthly_expense_limit;
    const spent = d.expense_limit_period === 'day' ? dayExp : monthExp;
    if (spent >= limit * 0.9) {
      await sendOneSignalNotification([String(u.id)], 'Alerta de limite', `Atingiu ${Math.round((spent / limit) * 100)}% do limite de ${d.expense_limit_period === 'day' ? 'dia' : 'mês'}.`, process.env.APP_URL || '/');
    }
  }
}

async function sendDailySummary() {
  const { data: users } = await supabase.from('swiftfinance_users').select('id,email,name');
  for (const u of users || []) {
    const d = await getUserData(u.id);
    const txs = d.transactions || [];
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
    const dayExp = txs.filter(t => t.type === 'expense' && t.date === yesterday).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const dayInc = txs.filter(t => t.type === 'income' && t.date === yesterday).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    if (dayExp > 0 || dayInc > 0) {
      await sendOneSignalNotification([String(u.id)], 'Resumo do dia', `Ontem gastou €${dayExp.toFixed(2)} e recebeu €${dayInc.toFixed(2)}.`, process.env.APP_URL || '/');
    }
  }
}

async function sendWeeklySummary() {
  const { data: users } = await supabase.from('swiftfinance_users').select('id,email,name');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  for (const u of users || []) {
    const d = await getUserData(u.id);
    const txs = d.transactions || [];
    const weekExp = txs.filter(t => t.type === 'expense' && new Date(t.date) >= start).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const weekInc = txs.filter(t => t.type === 'income' && new Date(t.date) >= start).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const html = buildEmailTemplate('Resumo semanal SwiftFinance', `Aqui está o resumo da sua semana.`, [
      { label: 'Despesas', value: `€${weekExp.toFixed(2)}` },
      { label: 'Rendimentos', value: `€${weekInc.toFixed(2)}` },
      { label: 'Saldo', value: `€${(weekInc - weekExp).toFixed(2)}` }
    ], process.env.APP_URL || '/', 'Abrir painel', u.name || u.email);
    await sendEmail(u.email, 'Resumo semanal SwiftFinance', html);
  }
}

async function sendMonthlySummary() {
  const { data: users } = await supabase.from('swiftfinance_users').select('id,email,name');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  for (const u of users || []) {
    const d = await getUserData(u.id);
    const txs = d.transactions || [];
    const monthExp = txs.filter(t => t.type === 'expense' && new Date(t.date) >= start).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const monthInc = txs.filter(t => t.type === 'income' && new Date(t.date) >= start).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const html = buildEmailTemplate('Relatório mensal SwiftFinance', `O seu relatório financeiro de ${UK_MONTH_NAMES[now.getMonth()]}.`, [
      { label: 'Despesas totais', value: `€${monthExp.toFixed(2)}` },
      { label: 'Rendimentos totais', value: `€${monthInc.toFixed(2)}` },
      { label: 'Saldo', value: `€${(monthInc - monthExp).toFixed(2)}` }
    ], process.env.APP_URL || '/', 'Ver relatório completo', u.name || u.email);
    await sendEmail(u.email, 'Relatório mensal SwiftFinance', html);
  }
}

if (process.env.NODE_ENV !== 'development') {
  cron.schedule('*/30 * * * *', checkLimitsAndNotify);
  cron.schedule('0 19 * * *', sendDailySummary);
  cron.schedule('0 9 * * 1', sendWeeklySummary);
  cron.schedule('0 9 1 * *', sendMonthlySummary);
}

async function seedInitialData() {
  const { data: admin } = await supabase.from('swiftfinance_users').select('id').ilike('email', 'ivandro.work@gmail.com').single();
  if (!admin) {
    await supabase.from('swiftfinance_users').insert({
      email: 'ivandro.work@gmail.com',
      password_hash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      name: 'Ivandro'
    });
  }
  const { data: eva } = await supabase.from('swiftfinance_users').select('id').ilike('email', 'eva.cruz.work@gmail.com').single();
  if (!eva) {
    await supabase.from('swiftfinance_users').insert({
      email: 'eva.cruz.work@gmail.com',
      password_hash: bcrypt.hashSync('eva2026', 10),
      role: 'user',
      name: 'Eva'
    });
  }
  const { data: plans } = await supabase.from('swiftfinance_plans').select('id');
  if (!plans || plans.length === 0) {
    await supabase.from('swiftfinance_plans').insert([
      { name: 'Simple', description: 'O essencial para começar a controlar as suas finanças.', price: 0, stripe_price_id: 'price_free', price_id: 'price_free', features: ['Contas e despesas ilimitadas','Categorias personalizadas','Resumo financeiro mensal','Acesso web e mobile'], popular: false, sort_order: 1, active: true },
      { name: 'Advance', description: 'Mais detalhe, automação e inteligência para crescer.', price: 4.99, stripe_price_id: 'price_advance', price_id: 'price_advance', features: ['Tudo do plano Simple','Metas e orçamentos avançados','Insights e relatórios inteligentes','Exportação e sincronização'], popular: true, sort_order: 2, active: true }
    ]);
  }
}
seedInitialData().catch(console.error);

// Static & SPA
app.all('/api/*', (req, res) => res.status(404).json({ message: 'Não encontrado' }));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.use(express.static(__dirname, { index: false }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log('SwiftFinance running on port ' + PORT));
