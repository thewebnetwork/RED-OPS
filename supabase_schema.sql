-- Red Ribbon Ops - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Standard User',
    account_type VARCHAR(50) NOT NULL DEFAULT 'media_client',
    phone VARCHAR(50),
    company VARCHAR(255),
    team_id UUID,
    specialty_ids UUID[],
    capabilities TEXT[],
    is_active BOOLEAN DEFAULT true,
    otp_secret TEXT,
    otp_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    members UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories L1
CREATE TABLE categories_l1 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_es VARCHAR(255),
    name_pt VARCHAR(255),
    description TEXT,
    icon VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories L2 (subcategories)
CREATE TABLE categories_l2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories_l1(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_es VARCHAR(255),
    name_pt VARCHAR(255),
    description TEXT,
    icon VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders (main request/ticket entity)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code VARCHAR(50) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    request_type VARCHAR(50) DEFAULT 'Request',
    status VARCHAR(50) DEFAULT 'Draft',
    priority VARCHAR(50) DEFAULT 'Normal',
    requester_id UUID REFERENCES users(id),
    editor_id UUID,
    category_l1_id UUID REFERENCES categories_l1(id),
    category_l2_id UUID,
    category_name VARCHAR(255),
    requester_team_id UUID,
    assigned_team_id UUID,
    specialty_id UUID,
    specialty_name VARCHAR(255),
    pool_number INTEGER,
    pool_entered_at TIMESTAMP WITH TIME ZONE,
    sla_deadline TIMESTAMP WITH TIME ZONE,
    is_sla_breached BOOLEAN DEFAULT false,
    delivered_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    rating INTEGER,
    review_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Messages
CREATE TABLE order_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    sender_name VARCHAR(255),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Files
CREATE TABLE order_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Specialties
CREATE TABLE specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pool_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    permissions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SLA Policies
CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_l1_id UUID REFERENCES categories_l1(id),
    priority VARCHAR(50),
    response_time_hours INTEGER,
    resolution_time_hours INTEGER,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50),
    trigger_conditions JSONB,
    actions JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2),
    features TEXT[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_orders_requester ON orders(requester_id);
CREATE INDEX idx_orders_editor ON orders(editor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_order_messages_order ON order_messages(order_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- Insert default admin user (password: Admin123!)
-- Password hash for 'Admin123!' using bcrypt
INSERT INTO users (id, email, password_hash, full_name, role, account_type, is_active)
VALUES (
    uuid_generate_v4(),
    'admin@redribbonops.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5ztT.dQ7hqO7u',
    'System Administrator',
    'Administrator',
    'admin',
    true
);

-- Insert sample categories
INSERT INTO categories_l1 (name, name_es, name_pt, icon) VALUES
    ('Content Creation', 'Creación de Contenido', 'Criação de Conteúdo', 'content'),
    ('Video Production', 'Producción de Video', 'Produção de Vídeo', 'video'),
    ('Design', 'Diseño', 'Design', 'design'),
    ('Marketing', 'Marketing', 'Marketing', 'marketing'),
    ('Technical Support', 'Soporte Técnico', 'Suporte Técnico', 'support');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to orders
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
