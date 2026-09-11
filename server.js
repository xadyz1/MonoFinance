require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;
const DB_FILE = path.join(__dirname, 'db.json');

// ── Simple JSON DB ──
let db = { users: [], userData: [] };
function loadDB() {
  try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch(e) { db = { users: [], userData: [] }; }
  if (!db.users) db.users = [];
  if (!db.userData) db.userData = [];
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function nextId(arr) { return arr.length ? Math.max(...arr.map(r=>r.id)) + 1 : 1; }

loadDB();

// Init admin user
if (!db.users.find(u => u.username === 'ivandro.work@gmail.com')) {
  db.users.push({ id: nextId(db.users), username: 'ivandro.work@gmail.com', password_hash: bcrypt.hashSync('admin123', 10), role: 'admin' });
  const uid = db.users[db.users.length-1].id;
  db.userData.push({ user_id: uid, transactions: '[]', savings_target: 10000, recurring_expenses: '[]', savings_goals: '[]', daily_expense_limit: 1000, weekly_expense_limit: 7000, monthly_expense_limit: 30000, expense_limit_period: 'day' });
  saveDB();
  console.log('Admin seeded: ivandro.work@gmail.com / admin123');
}

// Remove legacy demo user
const sergIdx = db.users.findIndex(u => u.username === 'serg');
if (sergIdx >= 0) { const sid = db.users[sergIdx].id; db.users.splice(sergIdx, 1); db.userData = db.userData.filter(d => d.user_id !== sid); saveDB(); }

// ── Middleware ──
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'swiftfinance_secret_2026', resave: false, saveUninitialized: false, cookie: { maxAge: 30*24*60*60*1000, sameSite: 'lax', httpOnly: true } }));
app.use((req,res,next) => { res.set('Cache-Control','no-cache,no-store,must-revalidate'); next(); });

const requireAuth = (req,res,next) => { if(!req.session.userId) return res.status(401).json({message:'Não autenticado'}); next(); };
const requireAdmin = (req,res,next) => { if(!req.session.userId) return res.status(401).json({message:'Não autenticado'}); const u=db.users.find(x=>x.id===req.session.userId); if(!u||u.role!=='admin') return res.status(403).json({message:'Sem permissão'}); next(); };

// ── Auth ──
app.post('/api/register', (req,res) => {
  const {username,password}=req.body||{};
  if(!username||!password) return res.status(400).json({message:'Obrigatório'});
  if(db.users.find(u=>u.username.toLowerCase()===username.toLowerCase())) return res.status(409).json({message:'Já existe'});
  const id=nextId(db.users);
  db.users.push({id,username,password_hash:bcrypt.hashSync(password,10),role:'user'});
  db.userData.push({user_id:id,transactions:'[]',savings_target:10000,recurring_expenses:'[]',savings_goals:'[]',daily_expense_limit:1000,weekly_expense_limit:7000,monthly_expense_limit:30000,expense_limit_period:'day'});
  saveDB(); req.session.userId=id; req.session.username=username;
  res.json({message:'Conta criada',username});
});
app.post('/api/login', (req,res) => {
  const {username,password}=req.body||{};
  if(!username||!password) return res.status(400).json({message:'Obrigatório'});
  const u=db.users.find(x=>x.username.toLowerCase()===username.toLowerCase());
  if(!u||!bcrypt.compareSync(password,u.password_hash)) return res.status(401).json({message:'Dados incorrectos'});
  req.session.userId=u.id; req.session.username=u.username;
  res.json({message:'OK',username:u.username});
});
app.post('/api/logout', (req,res) => { req.session.destroy(); res.json({message:'OK'}); });
app.get('/api/me', (req,res) => {
  if(!req.session.userId) return res.status(401).json({message:'Não autenticado'});
  const u=db.users.find(x=>x.id===req.session.userId);
  res.json({username:req.session.username,role:u?u.role:'user'});
});
app.post('/api/change-password', requireAuth, (req,res) => {
  const {old_password,new_password}=req.body||{};
  if(!old_password||!new_password||new_password.length<4) return res.status(400).json({message:'Dados inválidos'});
  const u=db.users.find(x=>x.id===req.session.userId);
  if(!u||!bcrypt.compareSync(old_password,u.password_hash)) return res.status(401).json({message:'Password incorreta'});
  u.password_hash=bcrypt.hashSync(new_password,10); saveDB();
  res.json({message:'OK'});
});

// ── Data ──
app.get('/api/data', requireAuth, (req,res) => {
  let d=db.userData.find(x=>x.user_id===req.session.userId);
  if(!d) { d={user_id:req.session.userId,transactions:'[]',savings_target:10000,recurring_expenses:'[]',savings_goals:'[]',daily_expense_limit:1000,weekly_expense_limit:7000,monthly_expense_limit:30000,expense_limit_period:'day'}; db.userData.push(d); saveDB(); }
  res.json({transactions:JSON.parse(d.transactions||'[]'),savingsTarget:d.savings_target,recurringExpenses:JSON.parse(d.recurring_expenses||'[]'),savingsGoals:JSON.parse(d.savings_goals||'[]'),dailyExpenseLimit:d.daily_expense_limit,weeklyExpenseLimit:d.weekly_expense_limit,monthlyExpenseLimit:d.monthly_expense_limit,expenseLimitPeriod:d.expense_limit_period});
});
app.post('/api/data', requireAuth, (req,res) => {
  const b=req.body||{}; let d=db.userData.find(x=>x.user_id===req.session.userId);
  if(!d) { d={user_id:req.session.userId}; db.userData.push(d); }
  d.transactions=JSON.stringify(b.transactions||[]); d.savings_target=b.savingsTarget||10000;
  d.recurring_expenses=JSON.stringify(b.recurringExpenses||[]); d.savings_goals=JSON.stringify(b.savingsGoals||[]);
  d.daily_expense_limit=b.dailyExpenseLimit||1000; d.weekly_expense_limit=b.weeklyExpenseLimit||7000;
  d.monthly_expense_limit=b.monthlyExpenseLimit||30000; d.expense_limit_period=b.expenseLimitPeriod||'day';
  saveDB(); res.json({message:'OK'});
});

// ── Admin ──
app.get('/api/admin/users', requireAdmin, (req,res) => { res.json({users:db.users.map(u=>({id:u.id,username:u.username,role:u.role}))}); });
app.post('/api/admin/user', requireAdmin, (req,res) => {
  const {username,password,role}=req.body||{};
  if(!username||!password) return res.status(400).json({message:'Obrigatório'});
  if(db.users.find(u=>u.username.toLowerCase()===username.toLowerCase())) return res.status(409).json({message:'Já existe'});
  const id=nextId(db.users);
  db.users.push({id,username,password_hash:bcrypt.hashSync(password,10),role:role||'user'});
  db.userData.push({user_id:id,transactions:'[]',savings_target:10000,recurring_expenses:'[]',savings_goals:'[]',daily_expense_limit:1000,weekly_expense_limit:7000,monthly_expense_limit:30000,expense_limit_period:'day'});
  saveDB(); res.json({message:'OK'});
});
app.delete('/api/admin/user/:id', requireAdmin, (req,res) => {
  const id=parseInt(req.params.id); if(id===req.session.userId) return res.status(400).json({message:'Não pode eliminar a si mesmo'});
  db.users=db.users.filter(u=>u.id!==id); db.userData=db.userData.filter(d=>d.user_id!==id); saveDB();
  res.json({message:'OK'});
});
app.put('/api/admin/user/:id/role', requireAdmin, (req,res) => {
  const {role}=req.body||{}; if(!['admin','user'].includes(role)) return res.status(400).json({message:'Inválido'});
  const u=db.users.find(x=>x.id===parseInt(req.params.id)); if(u) { u.role=role; saveDB(); }
  res.json({message:'OK'});
});

// ── AI Categorize ──
app.post('/api/categorize', requireAuth, async (req,res) => {
  const {description,type}=req.body||{}; const def=type==='income'?'Outros rendimentos':'Outras despesas';
  const KEY=process.env.GROQ_API_KEY; if(!description||!KEY) return res.json({category:def});
  const cats=type==='income'?['Salário','Freelance e projetos','Prémios e gorjetas','Investimentos e cashback','Outros rendimentos']:['Alimentação','Cafés e restaurantes','Transporte e automóvel','Habitação e utilidades','Saúde e desporto','Compras e vestuário','Lazer e entretenimento','Outras despesas'];
  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:'Return ONLY category from: '+cats.join(', ')},{role:'user',content:'"'+description+'" '+type}],temperature:0.1,max_tokens:30})});
    const d=await r.json(); const c=(d.choices?.[0]?.message?.content||'').trim();
    res.json({category:cats.includes(c)?c:def});
  }catch(e){ res.json({category:def}); }
});

// ── Voice ──
app.post('/api/voice-transcribe', requireAuth, async (req,res) => {
  const KEY=process.env.GROQ_API_KEY; if(!KEY) return res.status(500).json({message:'API key não configurada'});
  try{
    const chunks=[]; req.on('data',c=>chunks.push(c));
    await new Promise(r=>req.on('end',r));
    const body=JSON.parse(Buffer.concat(chunks).toString());
    const audio=Buffer.from(body.audio,'base64');
    const fd=new FormData(); fd.append('file',new Blob([audio],{type:'audio/webm'}),'audio.webm'); fd.append('model','whisper-large-v3'); fd.append('language','pt');
    const r=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{'Authorization':'Bearer '+KEY},body:fd});
    const d=await r.json(); res.json({text:d.text||''});
  }catch(e){ res.status(500).json({message:'Erro ao transcrever'}); }
});

// ── Static & SPA ──
app.all('/api/*', (req,res)=>res.status(404).json({message:'Não encontrado'}));
app.get('/login', (req,res)=>res.sendFile(path.join(__dirname,'login.html')));
app.get('/app', (req,res)=>res.sendFile(path.join(__dirname,'app.html')));
app.use(express.static(__dirname, {index:false}));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));

app.listen(PORT, ()=>console.log('SwiftFinance running on port '+PORT));
