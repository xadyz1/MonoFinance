import os
import re
import sqlite3
import json
import threading
import time
import random
import tempfile
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        os.environ[k.strip()] = v.strip().strip("'\"")
        except Exception as e:
            print(f"Error loading .env file: {e}")

load_env()

app = Flask(__name__)
app.secret_key = 'swiftfinance_secret_super_key_2026'
# Configure session cookie settings
app.config['PERMANENT_SESSION_LIFETIME'] = 86400 * 30  # 30 days
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'monofinance.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def get_kyiv_now():
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Kyiv"))
    except Exception:
        return datetime.now(timezone(timedelta(hours=3)))

def process_all_recurring_expenses():
    now = get_kyiv_now()
    today_str = now.strftime("%Y-%m-%d")
    today_day_num = now.day

    year = now.year
    month = now.month
    if month in [1, 3, 5, 7, 8, 10, 12]:
        max_day_in_month = 31
    elif month in [4, 6, 9, 11]:
        max_day_in_month = 30
    else:
        is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
        max_day_in_month = 29 if is_leap else 28

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, transactions, recurring_expenses FROM user_data")
        rows = cursor.fetchall()
        
        updated_users_count = 0
        total_tx_added = 0

        for row in rows:
            user_id = row['user_id']
            try:
                transactions = json.loads(row['transactions']) if row['transactions'] else []
                recurring = json.loads(row['recurring_expenses']) if row['recurring_expenses'] else []
            except Exception:
                continue

            added_count = 0
            for item in recurring:
                scheduled_days = item.get('days')
                if not scheduled_days:
                    day_of_month = item.get('dayOfMonth', 1)
                    scheduled_days = [day_of_month]

                amount = item.get('amount', 0)
                description = item.get('description', '')
                if not amount or not description:
                    continue

                for scheduled_day in scheduled_days:
                    is_due_today = (today_day_num == scheduled_day) or (today_day_num == max_day_in_month and scheduled_day > max_day_in_month)
                    if is_due_today:
                        target_description = f"{description} (Автосписання)"
                        already_exists = any(
                            t.get('type') == 'expense' and 
                            t.get('description') == target_description and 
                            t.get('date') == today_str
                            for t in transactions
                        )
                        if not already_exists:
                            new_tx = {
                                "id": str(int(time.time() * 1000) + random.randint(1, 999)),
                                "amount": float(amount),
                                "type": "expense",
                                "description": target_description,
                                "date": today_str
                            }
                            transactions.append(new_tx)
                            added_count += 1

            if added_count > 0:
                cursor.execute(
                    "UPDATE user_data SET transactions = ? WHERE user_id = ?",
                    (json.dumps(transactions), user_id)
                )
                updated_users_count += 1
                total_tx_added += added_count

        if updated_users_count > 0:
            conn.commit()
            print(f"[{now.strftime('%Y-%m-%d %H:%M:%S Kyiv')}] Background recurring debit: added {total_tx_added} expense(s) for {updated_users_count} user(s).")
        conn.close()
    except Exception as e:
        print(f"Error in process_all_recurring_expenses: {e}")

def start_background_scheduler():
    def scheduler_loop():
        # Catch up immediately when server starts
        process_all_recurring_expenses()
        while True:
            time.sleep(600)  # Check every 10 minutes
            process_all_recurring_expenses()

    thread = threading.Thread(target=scheduler_loop, daemon=True)
    thread.start()

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user'
        )
    ''')
    # Create user_data table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_data (
            user_id INTEGER UNIQUE NOT NULL,
            transactions TEXT NOT NULL,
            savings_target REAL NOT NULL DEFAULT 10000.0,
            recurring_expenses TEXT NOT NULL,
            savings_goals TEXT DEFAULT '[]',
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Migration: add role column if missing
    cursor.execute("PRAGMA table_info(users)")
    user_cols = [col['name'] for col in cursor.fetchall()]
    if 'role' not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
    
    # Migration for user_data columns
    cursor.execute("PRAGMA table_info(user_data)")
    columns = [col['name'] for col in cursor.fetchall()]
    if 'savings_goals' not in columns:
        cursor.execute("ALTER TABLE user_data ADD COLUMN savings_goals TEXT DEFAULT '[]'")
    if 'daily_expense_limit' not in columns:
        cursor.execute("ALTER TABLE user_data ADD COLUMN daily_expense_limit REAL DEFAULT 1000.0")
    if 'weekly_expense_limit' not in columns:
        cursor.execute("ALTER TABLE user_data ADD COLUMN weekly_expense_limit REAL DEFAULT 7000.0")
    if 'monthly_expense_limit' not in columns:
        cursor.execute("ALTER TABLE user_data ADD COLUMN monthly_expense_limit REAL DEFAULT 30000.0")
    if 'expense_limit_period' not in columns:
        cursor.execute("ALTER TABLE user_data ADD COLUMN expense_limit_period TEXT DEFAULT 'day'")
    
    conn.commit()

    # Seed master admin if not exists
    cursor.execute("SELECT id FROM users WHERE username = ?", ('ivandro.work@gmail.com',))
    user = cursor.fetchone()
    if not user:
        p_hash = generate_password_hash('admin123')
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                       ('ivandro.work@gmail.com', p_hash, 'admin'))
        user_id = cursor.lastrowid
        cursor.execute('''INSERT OR IGNORE INTO user_data (user_id, transactions, savings_target, recurring_expenses, savings_goals, daily_expense_limit, weekly_expense_limit, monthly_expense_limit, expense_limit_period)
            VALUES (?, '[]', 10000.0, '[]', '[]', 1000.0, 7000.0, 30000.0, 'day')''', (user_id,))
        conn.commit()
    
    # Remove legacy demo user 'serg' if exists
    cursor.execute("SELECT id FROM users WHERE username = ?", ('serg',))
    serg = cursor.fetchone()
    if serg:
        cursor.execute("DELETE FROM user_data WHERE user_id = ?", (serg[0],))
        cursor.execute("DELETE FROM users WHERE id = ?", (serg[0],))
        conn.commit()

    conn.close()

# Initialize DB and start background scheduler on startup
init_db()
start_background_scheduler()

@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/login')
def serve_login():
    return send_from_directory('.', 'login.html')

@app.route('/app.html')
def serve_app():
    return send_from_directory('.', 'app.html')

@app.route('/styles.css')
def serve_css():
    return send_from_directory('.', 'styles.css')

@app.route('/app.js')
def serve_js():
    return send_from_directory('.', 'app.js')

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory('.', 'manifest.json')

@app.route('/favicon.svg')
def serve_favicon():
    return send_from_directory('.', 'favicon.svg')

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('.', 'sw.js')

@app.route('/<path:filename>')
def serve_static(filename):
    if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)):
        return send_from_directory('.', filename)
    return send_from_directory('.', 'app.html')


def get_request_data():
    data = request.get_json(silent=True, force=True)
    if not data or not isinstance(data, dict):
        try:
            raw_body = request.get_data(as_text=True)
            if raw_body:
                data = json.loads(raw_body)
        except Exception:
            pass
    if not data or not isinstance(data, dict):
        data = request.form.to_dict() or {}
    return data or {}

# Authentication API
@app.route('/api/register', methods=['POST'])
def register():
    data = get_request_data()
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))
    
    if not username or not password:
        return jsonify({'message': 'O nome de utilizador e a password são obrigatórios'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'message': 'Já existe um utilizador com esse nome'}), 400

    try:
        p_hash = generate_password_hash(password)
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, p_hash))
        user_id = cursor.lastrowid
        
        # Create empty initial data
        cursor.execute('''
            INSERT INTO user_data (user_id, transactions, savings_target, recurring_expenses, savings_goals, daily_expense_limit, weekly_expense_limit, monthly_expense_limit, expense_limit_period)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, json.dumps([]), 10000.0, json.dumps([]), json.dumps([]), 1000.0, 7000.0, 30000.0, 'day'))
        conn.commit()
        
        session.permanent = True
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'message': 'Registo realizado com sucesso', 'username': username}), 201
    except sqlite3.IntegrityError:
        return jsonify({'message': 'Já existe um utilizador com esse nome'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = get_request_data()
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))
    
    if not username or not password:
        return jsonify({'message': 'O nome de utilizador e a password são obrigatórios'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        session.permanent = True
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'message': 'Sessão iniciada com sucesso', 'username': user['username']})
        
    return jsonify({'message': 'Nome de utilizador ou password incorretos'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({'message': 'Sessão terminada'})

@app.route('/api/change-password', methods=['POST'])
def change_password():
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
    data = request.get_json() or {}
    old_password = data.get('old_password') or ''
    new_password = data.get('new_password') or ''
    if not old_password or not new_password:
        return jsonify({'message': 'Passwords obrigatórias'}), 400
    if len(new_password) < 4:
        return jsonify({'message': 'Nova password deve ter pelo menos 4 caracteres'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ?", (session['user_id'],))
    row = cursor.fetchone()
    if not row or not check_password_hash(row['password_hash'], old_password):
        conn.close()
        return jsonify({'message': 'Password atual incorreta'}), 401
    new_hash = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Password alterada com sucesso'})

@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
        row = cursor.fetchone()
        conn.close()
        role = row['role'] if row else 'user'
        return jsonify({'username': session['username'], 'role': role})
    return jsonify({'message': 'Não autenticado'}), 401

# Admin API
@app.route('/api/admin/users', methods=['GET'])
def admin_list_users():
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    me_row = cursor.fetchone()
    if not me_row or me_row['role'] != 'admin':
        conn.close()
        return jsonify({'message': 'Sem permissão'}), 403
    cursor.execute("SELECT id, username, role FROM users ORDER BY id")
    users = [{'id': r['id'], 'username': r['username'], 'role': r['role']} for r in cursor.fetchall()]
    conn.close()
    return jsonify({'users': users})

@app.route('/api/admin/user', methods=['POST'])
def admin_create_user():
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    me_row = cursor.fetchone()
    if not me_row or me_row['role'] != 'admin':
        conn.close()
        return jsonify({'message': 'Sem permissão'}), 403
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role = data.get('role') or 'user'
    if not username or not password:
        conn.close()
        return jsonify({'message': 'Nome e password obrigatórios'}), 400
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'message': 'Utilizador já existe'}), 409
    p_hash = generate_password_hash(password)
    cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, p_hash, role))
    user_id = cursor.lastrowid
    cursor.execute('''INSERT OR IGNORE INTO user_data (user_id, transactions, savings_target, recurring_expenses, savings_goals, daily_expense_limit, weekly_expense_limit, monthly_expense_limit, expense_limit_period)
        VALUES (?, '[]', 10000.0, '[]', '[]', 1000.0, 7000.0, 30000.0, 'day')''', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Conta criada com sucesso'}), 201

@app.route('/api/admin/user/<int:target_id>', methods=['DELETE'])
def admin_delete_user(target_id):
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    me_row = cursor.fetchone()
    if not me_row or me_row['role'] != 'admin':
        conn.close()
        return jsonify({'message': 'Sem permissão'}), 403
    if target_id == session['user_id']:
        conn.close()
        return jsonify({'message': 'Não é possível eliminar a própria conta'}), 400
    cursor.execute("DELETE FROM user_data WHERE user_id = ?", (target_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (target_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Utilizador eliminado'})

@app.route('/api/admin/user/<int:target_id>/role', methods=['PUT'])
def admin_update_role(target_id):
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    me_row = cursor.fetchone()
    if not me_row or me_row['role'] != 'admin':
        conn.close()
        return jsonify({'message': 'Sem permissão'}), 403
    data = request.get_json() or {}
    new_role = data.get('role') or 'user'
    if new_role not in ('admin', 'user'):
        conn.close()
        return jsonify({'message': 'Role inválido'}), 400
    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, target_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Role atualizado'})

# Data Sync API
# Data Sync API
@app.route('/api/data', methods=['GET'])
def get_user_data():
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
        
    process_all_recurring_expenses()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT transactions, savings_target, recurring_expenses, savings_goals, daily_expense_limit, weekly_expense_limit, monthly_expense_limit, expense_limit_period FROM user_data WHERE user_id = ?", (session['user_id'],))
        row = cursor.fetchone()
    finally:
        conn.close()
    
    if not row:
        return jsonify({
            'transactions': [],
            'savingsTarget': 10000.0,
            'recurringExpenses': [],
            'savingsGoals': [],
            'dailyExpenseLimit': 1000.0,
            'weeklyExpenseLimit': 7000.0,
            'monthlyExpenseLimit': 30000.0,
            'expenseLimitPeriod': 'day'
        })
        
    txs = []
    if 'transactions' in row.keys() and row['transactions']:
        try:
            txs = json.loads(row['transactions'])
        except Exception:
            txs = []

    recurring = []
    if 'recurring_expenses' in row.keys() and row['recurring_expenses']:
        try:
            recurring = json.loads(row['recurring_expenses'])
        except Exception:
            recurring = []

    goals = []
    if 'savings_goals' in row.keys() and row['savings_goals']:
        try:
            goals = json.loads(row['savings_goals'])
        except Exception:
            goals = []

    daily_limit = 1000.0
    if 'daily_expense_limit' in row.keys() and row['daily_expense_limit'] is not None:
        try:
            daily_limit = float(row['daily_expense_limit'])
        except Exception:
            daily_limit = 1000.0

    weekly_limit = 7000.0
    if 'weekly_expense_limit' in row.keys() and row['weekly_expense_limit'] is not None:
        try:
            weekly_limit = float(row['weekly_expense_limit'])
        except Exception:
            weekly_limit = 7000.0

    monthly_limit = 30000.0
    if 'monthly_expense_limit' in row.keys() and row['monthly_expense_limit'] is not None:
        try:
            monthly_limit = float(row['monthly_expense_limit'])
        except Exception:
            monthly_limit = 30000.0

    limit_period = 'day'
    if 'expense_limit_period' in row.keys() and row['expense_limit_period']:
        limit_period = str(row['expense_limit_period'])

    s_target = 10000.0
    if 'savings_target' in row.keys() and row['savings_target'] is not None:
        try:
            s_target = float(row['savings_target'])
        except Exception:
            s_target = 10000.0

    return jsonify({
        'transactions': txs,
        'savingsTarget': s_target,
        'recurringExpenses': recurring,
        'savingsGoals': goals,
        'dailyExpenseLimit': daily_limit,
        'weeklyExpenseLimit': weekly_limit,
        'monthlyExpenseLimit': monthly_limit,
        'expenseLimitPeriod': limit_period
    })

@app.route('/api/data', methods=['POST'])
def save_user_data():
    if 'user_id' not in session:
        return jsonify({'message': 'Não autenticado'}), 401
        
    data = get_request_data()
    transactions = data.get('transactions', [])
    savings_target = data.get('savingsTarget', 10000.0)
    recurring_expenses = data.get('recurringExpenses', [])
    savings_goals = data.get('savingsGoals', [])
    daily_expense_limit = data.get('dailyExpenseLimit', 1000.0)
    weekly_expense_limit = data.get('weeklyExpenseLimit', 7000.0)
    monthly_expense_limit = data.get('monthlyExpenseLimit', 30000.0)
    expense_limit_period = data.get('expenseLimitPeriod', 'day')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO user_data (user_id, transactions, savings_target, recurring_expenses, savings_goals, daily_expense_limit, weekly_expense_limit, monthly_expense_limit, expense_limit_period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            transactions = excluded.transactions,
            savings_target = excluded.savings_target,
            recurring_expenses = excluded.recurring_expenses,
            savings_goals = excluded.savings_goals,
            daily_expense_limit = excluded.daily_expense_limit,
            weekly_expense_limit = excluded.weekly_expense_limit,
            monthly_expense_limit = excluded.monthly_expense_limit,
            expense_limit_period = excluded.expense_limit_period
    ''', (session['user_id'], json.dumps(transactions), float(savings_target), json.dumps(recurring_expenses), json.dumps(savings_goals), float(daily_expense_limit), float(weekly_expense_limit), float(monthly_expense_limit), str(expense_limit_period)))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Дані успішно збережено'}), 200
    
@app.route('/api/voice-transcribe', methods=['POST'])
def voice_transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': 'Аудіофайл не знайдено'}), 400
        
    audio_file = request.files['audio']
    temp_dir = tempfile.gettempdir()
    orig_name = audio_file.filename or 'voice.webm'
    ext = os.path.splitext(orig_name)[1]
    if not ext:
        ext = '.webm'
    file_path = os.path.join(temp_dir, f"voice_{int(time.time())}{ext}")
    audio_file.save(file_path)
    
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    
    transcribed_text = ""
    
    try:
        # 1. Try Groq Whisper API if key is present
        if groq_api_key:
            import requests
            mime_type = audio_file.content_type or 'audio/webm'
            with open(file_path, 'rb') as f:
                response = requests.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {groq_api_key}"},
                    files={"file": (os.path.basename(file_path), f, mime_type)},
                    data={"model": "whisper-large-v3-turbo", "language": "uk"}
                )
            if response.status_code == 200:
                transcribed_text = response.json().get("text", "")
                
        # 2. Try OpenAI Whisper API if key is present
        elif openai_api_key:
            import requests
            with open(file_path, 'rb') as f:
                response = requests.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {openai_api_key}"},
                    files={"file": (os.path.basename(file_path), f, "audio/webm")},
                    data={"model": "whisper-1", "language": "uk"}
                )
            if response.status_code == 200:
                transcribed_text = response.json().get("text", "")
    except Exception as e:
        print(f"Error in transcription API: {e}")
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
                
    if not transcribed_text:
        return jsonify({
            'success': False if (groq_api_key or openai_api_key) else True,
            'text': transcribed_text,
            'message': 'API ключ не налаштовано на сервері або помилка розпізнавання'
        })
        
    return jsonify({
        'success': True,
        'text': transcribed_text
    })

ALLOWED_EXPENSE_CATEGORIES = [
    "Продукти харчування",
    "Кафе та ресторани",
    "Транспорт та Авто",
    "Комунальні та Житло",
    "Здоров'я та Спорт",
    "Покупки та Одяг",
    "Розваги та Дозвілля",
    "Інші витрати"
]

ALLOWED_INCOME_CATEGORIES = [
    "Зарплата",
    "Фріланс та Проєкти",
    "Премії та Чайові",
    "Інвестиції та Кешбек",
    "Інші доходи"
]

def find_historical_category(desc, tx_type, user_id):
    if not desc or not user_id:
        return None
    clean_desc = desc.lower().strip()
    if not clean_desc:
        return None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT transactions FROM user_data WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()

        if not row or not row['transactions']:
            return None

        tx_list = json.loads(row['transactions'])
        input_tokens = [w for w in re.split(r'[\s,.;:!?+*\/\\-_()]+', clean_desc) if len(w) >= 2]
        
        best_cat = None
        best_score = 0.0

        for t in tx_list:
            if not t or t.get('type') != tx_type:
                continue
            cat = t.get('category')
            if not cat or cat in ['Витрата', 'Різне', 'Інші витрати', 'Інші доходи', 'Голосове введення']:
                continue

            hist_desc = str(t.get('description', '')).lower().strip()
            if not hist_desc:
                continue

            if hist_desc == clean_desc:
                return cat

            if hist_desc in clean_desc or clean_desc in hist_desc:
                if 0.85 > best_score:
                    best_score = 0.85
                    best_cat = cat

            hist_tokens = [w for w in re.split(r'[\s,.;:!?+*\/\\-_()]+', hist_desc) if len(w) >= 2]
            if hist_tokens and input_tokens:
                shared = 0
                for it in input_tokens:
                    for ht in hist_tokens:
                        if it == ht or (len(it) >= 4 and ht.startswith(it[:4])) or (len(ht) >= 4 and it.startswith(ht[:4])):
                            shared += 1
                            break
                token_score = shared / max(len(input_tokens), len(hist_tokens))
                if token_score > best_score and token_score >= 0.4:
                    best_score = token_score
                    best_cat = cat

        return best_cat
    except Exception as e:
        print(f"Error in find_historical_category: {e}")
        return None

EXPENSE_STEM_MAP = {
    "Кафе та ресторани": [
        "макдональдз", "mcdonald", "кфс", "kfc", "піца", "піцері", "pizza", "суші", "sushi", "рол",
        "бургер", "burger", "шаурм", "шаверм", "донер", "кебаб", "фалафель", "сендвіч", "хот-дог",
        "хотдог", "вок", "рамен", "том ям", "боул", "кав'ярн", "кава", "кавус", "coffee", "cafe",
        "латте", "лате", "капучино", "американо", "еспресо", "флет вайт", "раф", "глясе", "матча",
        "ресторан", "кафе", "ланч", "обід", "сніданок", "вечер", "перекус", "бізнес ланч", "столов",
        "їдальн", "паб", "бар", "коктейль", "пиво", "сидр", "кальян", "заклад", "глово", "glovo",
        "bolt food", "доставка їж", "кур'єр їж"
    ],
    "Продукти харчування": [
        "бул", "булочк", "булк", "хліб", "батон", "круас", "пиріж", "пирог", "кекс", "мафін",
        "пончик", "донат", "лаваш", "багет", "паск", "бублик", "рогалик", "сухар", "грінк", "випіч",
        "пекарн", "чіабат", "паніні", "печив", "вафл", "торт", "тістеч", "пряник", "шоколад",
        "цукер", "солод", "зефір", "мармелад", "халв", "пастил", "льодяник", "карамел", "батончик",
        "морозив", "згущен", "м'яс", "мяс", "філе", "фарш", "стейк", "биточ", "котлет", "гуляш",
        "шашлик", "відбивн", "ковбас", "сосис", "сардел", "шинк", "бужен", "балик", "бекон", "сало",
        "курк", "куряч", "птиц", "індич", "качк", "гомілк", "крильц", "стегн", "ялович", "свинин",
        "телятин", "баранин", "риб", "форел", "лосос", "сьомг", "тунец", "тунц", "скумбр", "оселед",
        "хек", "минтай", "краб", "кревет", "міді", "кальмар", "морепрод", "ікр", "сир", "молок",
        "молоч", "масл", "смет", "йогурт", "кефір", "ряжанк", "вершк", "творог", "бринз", "сулугун",
        "пармезан", "моцарел", "яйц", "яєч", "овоч", "помідор", "томат", "огірок", "огірк", "капуст",
        "моркв", "буряк", "цибул", "часник", "перец", "перч", "картоп", "барабол", "пюре", "кабач",
        "баклаж", "гриб", "печериц", "зелен", "петруш", "кріп", "шпинат", "рукол", "фрукт", "яблук",
        "яблуч", "груш", "банан", "апельсин", "мандарин", "цитрус", "лимон", "лайм", "грейп", "персик",
        "нектарин", "абрикос", "слив", "виног", "хурм", "ківі", "ананас", "манго", "авокадо", "ягод",
        "полуниц", "клубнік", "малин", "лохин", "чорниц", "смородин", "порічк", "черешн", "вишн",
        "кавун", "дин", "макарон", "спагет", "вермішел", "круп", "гречк", "рис", "вівсян", "пшон",
        "булгур", "кускус", "кіноа", "горох", "квасол", "сочевиц", "кукурудз", "борос", "мук", "цукор",
        "цукр", "сіл", "олі", "оцет", "соус", "кетчуп", "майонез", "гірчиц", "спеці", "приправ",
        "снек", "чипс", "чіпс", "горіх", "горішк", "арахіс", "фундук", "мигдал", "кеш'ю", "кешью",
        "насін", "сім'я", "попкорн", "вод", "водичк", "мінералк", "сік", "сочок", "морс", "компот",
        "узвар", "квас", "лимонад", "кол", "пепс", "спрайт", "фант", "напі", "енергетик", "чай",
        "чайок", "какао", "цикорій", "супермарк", "маркет", "продукт", "гастрон", "магазин", "пакет",
        "купув", "їж", "харч", "пожив", "сільпо", "атб", "ашан", "варус", "фора", "metro", "novus",
        "траш", "кишеня", "таврія", "екомаркет", "ринок", "базар", "ларьок", "кіоск"
    ],
    "Транспорт та Авто": [
        "проїзд", "проїзн", "квиток", "талон", "метро", "автобус", "маршрутк", "тролейбус", "трамвай",
        "електричк", "поїзд", "потяг", "укрзалізниц", "інтерсіті", "вокзал", "таксі", "taxi", "uber",
        "убер", "uklon", "уклон", "bolt", "драйвер", "поїздк", "бензин", "дизель", "дт", "газ на авто",
        "пальн", "заправк", "азс", "окко", "wog", "socar", "upg", "брсм", "авіас", "shell", "автомийк",
        "автомийн", "мийка авто", "шиномонтаж", "сто", "ремонт авто", "запчастин", "детал", "масло моторн",
        "страховк", "осаго", "каско", "парковк", "паркінг", "штраф", "пдр", "прокат", "каршерінг",
        "самокат", "скутер", "байк", "велосипед", "авто", "машин"
    ],
    "Комунальні та Житло": [
        "комунал", "квартплат", "оренд", "rent", "житл", "квартир", "світл", "електроенерг", "дтек",
        "dtek", "ясно", "yasno", "газ", "нафтогаз", "водоканал", "гаряча вода", "холодна вода", "опален",
        "теплоенерг", "осбб", "жек", "смітт", "домофон", "інтернет", "провайдер", "роутер", "київстар дім",
        "воля", "ланет", "сантехнік", "електрик", "ремонт дім", "ремонт кварт", "будматеріал", "епіцентр",
        "леруа", "мебл", "ikea", "ікеа", "юск", "jysk", "господарсь", "побутова хім", "порошок", "миючий"
    ],
    "Здоров'я та Спорт": [
        "аптек", "ліки", "таблетк", "вітамін", "мазь", "крапл", "сироп", "антибіотик", "знеболюв",
        "бад", "пластир", "бинт", "термометр", "лікар", "клінік", "поліклінік", "лікарн", "госпітал",
        "прийом лікар", "консультаці", "аналіз", "сінево", "synevo", "діла", "dila", "узд", "мрт",
        "кт", "рентген", "стоматолог", "зуб", "пломб", "чистка зуб", "брекет", "окуліст", "зір",
        "окуляр", "лінз", "масаж", "терапі", "вакцин", "спорт", "gym", "fitness", "фітнес", "зал",
        "тренуван", "абонемент", "тренер", "басейн", "йог", "пілатес", "спорткомплекс", "спортінвентар",
        "протеїн", "гейнер", "гантел"
    ],
    "Покупки та Одяг": [
        "одяг", "взутт", "кросівк", "черевик", "туфл", "босоніжк", "куртк", "пальто", "пуховик",
        "вітровк", "джинс", "штани", "брюк", "футболк", "сорочк", "худі", "світшот", "светр",
        "кофт", "шорт", "платт", "сукн", "спідниц", "білизн", "шкарпетк", "шапк", "шарф", "рукавичк",
        "кепк", "сумк", "рюкзак", "гаманець", "ремін", "zara", "h&m", "bershka", "pull&bear",
        "mango", "stradivarius", "інтертоп", "intertop", "шопінг", "технік", "електронік", "ноутбук",
        "комп'ютер", "компютер", "монітор", "клавіатур", "мишк", "навушник", "airpods", "смартфон",
        "телефон", "iphone", "айфон", "чохол", "скло", "зарядк", "павербанк", "кабел", "планшет",
        "ipad", "годинник", "apple watch", "гаджет", "косметик", "парфум", "духи", "крем", "шампун",
        "гель для душ", "мило", "зубна паст", "щітк", "бритв", "дезодорант", "перукарн", "барбер",
        "барбершоп", "стрижк", "манікюр", "педикюр", "бров", "вії", "косметолог", "солярій",
        "подарунок", "квіт", "букет", "книг", "книжк", "канцеляр", "зоотовар", "корм для", "кіт",
        "котик", "собак", "ветклінік", "покупк", "придбав", "купив"
    ],
    "Розваги та Дозвілля": [
        "кіно", "кінотеатр", "фільм", "мультиплекс", "планета кіно", "театр", "вистав", "концерт",
        "фестиваль", "музей", "виставк", "боулінг", "більярд", "квест", "пейнтбол", "атракціон",
        "зоопарк", "аквапарк", "парк розваг", "ігр", "гра", "steam", "стим", "playstation", "ps store",
        "psn", "xbox", "nintendo", "epic games", "геймінг", "підписк", "подпіск", "subscription",
        "netflix", "spotify", "youtube premium", "apple music", "megogo", "sweet tv", "patreon",
        "telegram premium", "хобі", "настілк", "подорож", "туризм", "відпочинок", "готель",
        "hotel", "booking", "airbnb"
    ]
}

INCOME_STEM_MAP = {
    "Зарплата": ["зарплат", "salary", "робот", "аванс", "стипенд", "ставка", "получка"],
    "Премії та Чайові": ["чайов", "tip", "бонус", "премі", "подарунок"],
    "Інвестиції та Кешбек": ["дивіденд", "dividend", "акці", "інвест", "кешбек", "cashback", "повернен", "відсотк", "депозит", "крипт"],
    "Фріланс та Проєкти": ["фріланс", "freelance", "проєкт", "проект", "замовленн", "контракт", "розробк", "дизайн", "копірайт", "клієнт"]
}

def fallback_categorize(desc, tx_type):
    d = desc.lower().strip() if desc else ''
    if not d:
        return 'Інші доходи' if tx_type == 'income' else 'Інші витрати'
    if 'конверт' in d:
        return 'Конверти'

    if tx_type == 'income':
        for cat, stems in INCOME_STEM_MAP.items():
            if any(s in d for s in stems):
                return cat
        return 'Інші доходи'
    else:
        scores = {}
        for cat, stems in EXPENSE_STEM_MAP.items():
            score = sum(1 for s in stems if s in d)
            if score > 0:
                scores[cat] = score

        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]
        return 'Інші витрати'

CATEGORY_ICON_MAP = {
    "Продукти харчування": "shopping_cart",
    "Кафе та ресторани": "restaurant",
    "Транспорт та Авто": "directions_car",
    "Комунальні та Житло": "home",
    "Здоров'я та Спорт": "fitness_center",
    "Покупки та Одяг": "shopping_bag",
    "Розваги та Дозвілля": "movie",
    "Інші витрати": "receipt_long",
    "Зарплата": "work",
    "Фріланс та Проєкти": "computer",
    "Премії та Чайові": "redeem",
    "Інвестиції та Кешбек": "trending_up",
    "Інші доходи": "payments",
    "Конверти": "account_balance_wallet"
}

@app.route('/api/categorize', methods=['POST'])
def categorize_transaction():
    data = request.get_json(silent=True, force=True) or {}
    description = data.get('description', '').strip()
    tx_type = data.get('type', 'expense')
    
    if not description:
        def_cat = 'Інші витрати' if tx_type == 'expense' else 'Інші доходи'
        return jsonify({'success': True, 'category': def_cat, 'icon': CATEGORY_ICON_MAP.get(def_cat, 'receipt_long')})

    # 1. Historical User Transaction Match (fast & precise learning from user habits)
    user_id = session.get('user_id')
    hist_match = find_historical_category(description, tx_type, user_id)
    if hist_match:
        return jsonify({
            'success': True,
            'category': hist_match,
            'icon': CATEGORY_ICON_MAP.get(hist_match, 'receipt_long'),
            'source': 'history'
        })

    # 2. Local semantic stem matching baseline
    local_match = fallback_categorize(description, tx_type)
        
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    
    cat_result = None
    allowed_cats = ALLOWED_EXPENSE_CATEGORIES if tx_type == 'expense' else ALLOWED_INCOME_CATEGORIES

    if groq_api_key:
        try:
            import requests
            prompt = f"""Ти інтелектуальний фінансовий аналітик додатка SwiftFinance.
Твоє завдання — визначити найбільш відповідну категорію для витрати/доходу.
ВАЖЛИВО: Поріг класифікації МАКСИМАЛЬНО ЗНИЖЕНИЙ та гнучкий. Категорія 'Інші витрати' або 'Інші доходи' використовується ЛИШЕ у крайньому випадку випадкового набору символів.

ОСОБЛИВІ ПРАВИЛА РОЗПІЗНАВАННЯ:
- 'Продукти харчування': Будь-яка їжа, хлібобулочні вироби (булочка, булка, круасан, кекс, батон, хліб), солодощі, м'ясо, риба, сир, молочка, овочі, фрукти, напої, покупки в супермаркетах (Сільпо, АТБ, Варус, Фора тощо).
- 'Кафе та ресторани': Готова їжа з закладів, кав'ярні, кава, фастфуд, піца, суші, бургери, обіди, ланчі, ресторани, бари, доставки Glovo/Bolt Food.
- 'Транспорт та Авто': Таксі (Uklon, Bolt, Uber), метро, проїзд, квитки, бензин, паливо, заправки, автомийка, ремонт авто.
- 'Комунальні та Житло': Оренда, комуналка, світло, газ, вода, опалення, інтернет, ремонт житла, товари для дому.
- 'Здоров'я та Спорт': Аптека, ліки, лікарі, аналізи, стоматолог, спортзал, тренування, басейн.
- 'Покупки та Одяг': Одяг, взуття, техніка, електроніка, гаджети, косметика, догляд, побутові речі, зоотовари.
- 'Розваги та Дозвілля': Кіно, ігри, підписки (Netflix, Spotify, YouTube), концерти, подорожі, хобі.

Список дозволених категорій: {allowed_cats}
Поверни ЛИШЕ валідний JSON у форматі {{"category": "Назва зі списку"}}.

Опис операції: "{description}"
Тип операції: {tx_type}"""

            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1
                },
                timeout=3.0
            )
            if resp.status_code == 200:
                res_data = resp.json()
                content = res_data['choices'][0]['message']['content']
                parsed = json.loads(content)
                candidate = parsed.get("category", "").strip()
                if candidate in allowed_cats:
                    cat_result = candidate
        except Exception as e:
            print(f"Groq categorization error: {e}")
            
    elif openai_api_key:
        try:
            import requests
            prompt = f"""Ти інтелектуальний фінансовий аналітик додатка SwiftFinance.
Твоє завдання — класифікувати транзакцію з мінімальним порогом фільтрації. Будь-яка їжа та випічка (булочка, хліб тощо) належить до 'Продукти харчування' або 'Кафе та ресторани'.

Список дозволених категорій: {allowed_cats}
Поверни ЛИШЕ JSON у форматі {{"category": "Назва зі списку"}}.

Опис операції: "{description}"
Тип операції: {tx_type}"""

            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1
                },
                timeout=3.0
            )
            if resp.status_code == 200:
                res_data = resp.json()
                content = res_data['choices'][0]['message']['content']
                parsed = json.loads(content)
                candidate = parsed.get("category", "").strip()
                if candidate in allowed_cats:
                    cat_result = candidate
        except Exception as e:
            print(f"OpenAI categorization error: {e}")

    # If AI returned generic 'Other' category, but local semantic engine found a concrete category, prefer local!
    if (not cat_result or cat_result in ['Інші витрати', 'Інші доходи']) and local_match not in ['Інші витрати', 'Інші доходи']:
        cat_result = local_match
    elif not cat_result:
        cat_result = local_match

    icon_name = CATEGORY_ICON_MAP.get(cat_result, 'receipt_long')

    return jsonify({
        'success': True,
        'category': cat_result,
        'icon': icon_name
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
