require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'swiftfinance_secret_2026',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 30*24*60*60*1000, sameSite: 'lax', httpOnly: true }
}));

// Database
const db = new Database(path.join(__dirname, 'monofinance.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user')`);
  db.exec(`CREATE TABLE IF NOT EXISTS user_data (user_id INTEGER UNIQUE NOT NULL, transactions TEXT NOT NULL DEFAULT '[]', savings_target REAL NOT NULL DEFAULT 10000.0, recurring_expenses TEXT NOT NULL DEFAULT '[]', savings_goals TEXT DEFAULT '[]', daily_expense_limit REAL DEFAULT 1000.0, weekly_expense_limit REAL DEFAULT 7000.0, monthly_expense_limit REAL DEFAULT 30000.0, expense_limit_period TEXT DEFAULT 'day', FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE)`);
  const cols = db.prepare("PRAGMA table_info(user_data)").all().map(c=>c.name);
  if (!cols.includes('savings_goals')) db.exec("ALTER TABLE user_data ADD COLUMN savings_goals TEXT DEFAULT '[]'");
  if (!cols.includes('daily_expense_limit')) db.exec("ALTER TABLE user_data ADD COLUMN daily_expense_limit REAL DEFAULT 1000.0");
  if (!cols.includes('weekly_expense_limit')) db.exec("ALTER TABLE user_data ADD COLUMN weekly_expense_limit REAL DEFAULT 7000.0");
  if (!cols.includes('monthly_expense_limit')) db.exec("ALTER TABLE user_data ADD COLUMN monthly_expense_limit REAL DEFAULT 30000.0");
  if (!cols.includes('expense_limit_period')) db.exec("ALTER TABLE user_data ADD COLUMN expense_limit_period TEXT DEFAULT 'day'");
  const uc = db.prepare("PRAGMA table_info(users)").all().map(c=>c.name);
  if (!uc.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  if (!db.prepare("SELECT id FROM users WHERE username=?").get('ivandro.work@gmail.com')) {
    const h = bcrypt.hashSync('admin123',10);
    const info = db.prepare("INSERT INTO users (username,password_hash,role) VALUES (?,?,?)").run('ivandro.work@gmail.com',h,'admin');
    db.prepare("INSERT OR IGNORE INTO user_data (user_id,transactions,savings_target,recurring_expenses,savings_goals,daily_expense_limit,weekly_expense_limit,monthly_expense_limit,expense_limit_period) VALUES (?,'[]',10000.0,'[]','[]',1000.0,7000.0,30000.0,'day')").run(info.lastInsertRowid);
  }
  const serg = db.prepare("SELECT id FROM users WHERE username=?").get('serg');
  if (serg) { db.prepare("DELETE FROM user_data WHERE user_id=?").run(serg.id); db.prepare("DELETE FROM users WHERE id=?").run(serg.id); }
}
initDB();

app.use((req,res,next)=>{ res.set('Cache-Control','no-cache,no-store,must-revalidate'); next(); });

const requireAuth = (req,res,next) => { if(!req.session.userId) return res.status(401).json({message:'Não autenticado'}); next(); };
const requireAdmin = (req,res,next) => { if(!req.session.userId) return res.status(401).json({message:'Não autenticado'}); const u=db.prepare("SELECT role FROM users WHERE id=?").get(req.session.userId); if(!u||u.role!=='admin') return res.status(403).json({message:'Sem permissão'}); next(); };

app.post('/api/register', (req,res)=>{
  const {username,password}=req.body||{};
  if(!username||!password) return res.status(400).json({message:'Obrigatório'});
  if(db.prepare("SELECT id FROM users WHERE LOWER(username)=LOWER(?)").get(username)) return res.status(409).json({message:'Já existe'});
  const h=bcrypt.hashSync(password,10);
  const info=db.prepare("INSERT INTO users (username,password_hash,role) VALUES (?,?,'user')").run(username,h);
  db.prepare("INSERT OR IGNORE INTO user_data (user_id,transactions,savings_target,recurring_expenses,savings_goals,daily_expense_limit,weekly_expense_limit,monthly_expense_limit,expense_limit_period) VALUES (?,'[]',10000.0,'[]','[]',1000.0,7000.0,30000.0,'day')").run(info.lastInsertRowid);
  req.session.userId=info.lastInsertRowid; req.session.username=username;
  res.json({message:'Conta criada',username});
});
app.post('/api/login', (req,res)=>{
  const {username,password}=req.body||{};
  if(!username||!password) return res.status(400).json({message:'Obrigatório'});
  const u=db.prepare("SELECT id,username,password_hash FROM users WHERE LOWER(username)=LOWER(?)").get(username);
  if(!u||!bcrypt.compareSync(password,u.password_hash)) return res.status(401).json({message:'Dados incorrectos'});
  req.session.userId=u.id; req.session.username=u.username;
  res.json({message:'OK',username:u.username});
});
app.post('/api/logout', (req,res)=>{ req.session.destroy(); res.json({message:'OK'}); });
app.get('/api/me', (req,res)=>{
  if(!req.session.userId) return res.status(401).json({message:'Não autenticado'});
  const u=db.prepare("SELECT role FROM users WHERE id=?").get(req.session.userId);
  res.json({username:req.session.username,role:u?u.role:'user'});
});
app.post('/api/change-password', requireAuth, (req,res)=>{
  const {old_password,new_password}=req.body||{};
  if(!old_password||!new_password||new_password.length<4) return res.status(400).json({message:'Dados inválidos'});
  const u=db.prepare("SELECT password_hash FROM users WHERE id=?").get(req.session.userId);
  if(!u||!bcrypt.compareSync(old_password,u.password_hash)) return res.status(401).json({message:'Password incorreta'});
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(new_password,10),req.session.userId);
  res.json({message:'OK'});
});

// Data sync
app.get('/api/data', requireAuth, (req,res)=>{
  const r=db.prepare("SELECT * FROM user_data WHERE user_id=?").get(req.session.userId);
  if(!r) return res.json({transactions:[],savingsTarget:10000,recurringExpenses:[],savingsGoals:[],dailyExpenseLimit:1000,weeklyExpenseLimit:7000,monthlyExpenseLimit:30000,expenseLimitPeriod:'day'});
  res.json({transactions:JSON.parse(r.transactions||'[]'),savingsTarget:r.savings_target,recurringExpenses:JSON.parse(r.recurring_expenses||'[]'),savingsGoals:JSON.parse(r.savings_goals||'[]'),dailyExpenseLimit:r.daily_expense_limit,weeklyExpenseLimit:r.weekly_expense_limit,monthlyExpenseLimit:r.monthly_expense_limit,expenseLimitPeriod:r.expense_limit_period});
});
app.post('/api/data', requireAuth, (req,res)=>{
  const b=req.body||{};
  db.prepare("INSERT INTO user_data (user_id,transactions,savings_target,recurring_expenses,savings_goals,daily_expense_limit,weekly_expense_limit,monthly_expense_limit,expense_limit_period) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET transactions=excluded.transactions,savings_target=excluded.savings_target,recurring_expenses=excluded.recurring_expenses,savings_goals=excluded.savings_goals,daily_expense_limit=excluded.daily_expense_limit,weekly_expense_limit=excluded.weekly_expense_limit,monthly_expense_limit=excluded.monthly_expense_limit,expense_limit_period=excluded.expense_limit_period")
    .run(req.session.userId,JSON.stringify(b.transactions||[]),b.savingsTarget||10000,JSON.stringify(b.recurringExpenses||[]),JSON.stringify(b.savingsGoals||[]),b.dailyExpenseLimit||1000,b.weeklyExpenseLimit||7000,b.monthlyExpenseLimit||30000,b.expenseLimitPeriod||'day');
  res.json({message:'OK'});
});

// Admin
app.get('/api/admin/users', requireAdmin, (req,res)=>{ res.json({users:db.prepare("SELECT id,username,role FROM users ORDER BY id").all()}); });
app.post('/api/admin/user', requireAdmin, (req,res)=>{
  const {username,password,role}=req.body||{};
  if(!username||!password) return res.status(400).json({message:'Obrigatório'});
  if(db.prepare("SELECT id FROM users WHERE LOWER(username)=LOWER(?)").get(username)) return res.status(409).json({message:'Já existe'});
  const info=db.prepare("INSERT INTO users (username,password_hash,role) VALUES (?,?,?)").run(username,bcrypt.hashSync(password,10),role||'user');
  db.prepare("INSERT OR IGNORE INTO user_data (user_id,transactions,savings_target,recurring_expenses,savings_goals,daily_expense_limit,weekly_expense_limit,monthly_expense_limit,expense_limit_period) VALUES (?,'[]',10000.0,'[]','[]',1000.0,7000.0,30000.0,'day')").run(info.lastInsertRowid);
  res.json({message:'OK'});
});
app.delete('/api/admin/user/:id', requireAdmin, (req,res)=>{
  const id=parseInt(req.params.id); if(id===req.session.userId) return res.status(400).json({message:'Não pode eliminar a si mesmo'});
  db.prepare("DELETE FROM user_data WHERE user_id=?").run(id); db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({message:'OK'});
});
app.put('/api/admin/user/:id/role', requireAdmin, (req,res)=>{
  const {role}=req.body||{}; if(!['admin','user'].includes(role)) return res.status(400).json({message:'Inválido'});
  db.prepare("UPDATE users SET role=? WHERE id=?").run(role,parseInt(req.params.id));
  res.json({message:'OK'});
});

// AI Categorize
app.post('/api/categorize', requireAuth, async (req,res)=>{
  const {description,type}=req.body||{};
  const defaultCat=type==='income'?'Outros rendimentos':'Outras despesas';
  const GROQ_KEY=process.env.GROQ_API_KEY;
  if(!description||!GROQ_KEY) return res.json({category:defaultCat});
  const expCats=['Alimentação','Cafés e restaurantes','Transporte e automóvel','Habitação e utilidades','Saúde e desporto','Compras e vestuário','Lazer e entretenimento','Outras despesas'];
  const incCats=['Salário','Freelance e projetos','Prémios e gorjetas','Investimentos e cashback','Outros rendimentos'];
  const cats=type==='income'?incCats:expCats;
  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+GROQ_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:'Return ONLY category from: '+cats.join(', ')},{role:'user',content:'\"'+description+'\" '+type}],temperature:0.1,max_tokens:30})});
    const d=await r.json(); const c=(d.choices?.[0]?.message?.content||'').trim();
    res.json({category:cats.includes(c)?c:defaultCat});
  }catch(e){ res.json({category:defaultCat}); }
});
