-- Clean Database Script for LawAI
-- This script removes all existing tables and prepares for fresh schema

-- Drop all existing tables (in correct order to handle foreign keys)
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_sessions" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "cases" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "system_settings" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop enum types if they exist
DROP TYPE IF EXISTS "Role" CASCADE;

-- Note: This script is safe to run multiple times
-- It will clean the database for a fresh start
