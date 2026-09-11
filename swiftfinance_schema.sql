-- SwiftFinance Schema
-- Run this in Supabase SQL Editor

CREATE SCHEMA IF NOT EXISTS swiftfinance;

-- Users
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    name TEXT,
    avatar_url TEXT,
    plan_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings per user
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES swiftfinance.swiftfinance_users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Plans
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    stripe_price_id TEXT,
    price_id TEXT,
    features JSONB DEFAULT '[]',
    popular BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES swiftfinance.swiftfinance_users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES swiftfinance.swiftfinance_plans(id) ON DELETE SET NULL,
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'active',
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES swiftfinance.swiftfinance_users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advertising slots
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_advertising (
    id SERIAL PRIMARY KEY,
    slot_name TEXT UNIQUE NOT NULL,
    html TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts
CREATE TABLE IF NOT EXISTS swiftfinance.swiftfinance_receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES swiftfinance.swiftfinance_users(id) ON DELETE CASCADE,
    transaction_id INTEGER,
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (optional but recommended)
ALTER TABLE swiftfinance.swiftfinance_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE swiftfinance.swiftfinance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE swiftfinance.swiftfinance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swiftfinance.swiftfinance_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swiftfinance.swiftfinance_receipts ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user ON swiftfinance.swiftfinance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON swiftfinance.swiftfinance_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON swiftfinance.swiftfinance_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON swiftfinance.swiftfinance_receipts(transaction_id);
