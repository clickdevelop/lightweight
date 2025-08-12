import dotenv from 'dotenv';
dotenv.config();

// This file reads environment variables and provides them to the application.
// It's crucial that no default credentials or sensitive data are hardcoded here.

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  ARCHITECTURE: process.env.ARCHITECTURE || 'none',
  PORT: parseInt(process.env.PORT || '2000', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET,
  AUTH_ENABLED: process.env.AUTH_ENABLED === 'true', // Correctly handle boolean

  // Authentication Model Configuration
  AUTH_MODEL_NAME: process.env.AUTH_MODEL_NAME || 'User',
  AUTH_USERNAME_FIELD: process.env.AUTH_USERNAME_FIELD || 'username',
  AUTH_EMAIL_FIELD: process.env.AUTH_EMAIL_FIELD || 'email', // Added for flexible login
  AUTH_PASSWORD_FIELD: process.env.AUTH_PASSWORD_FIELD || 'password',

  // Database - No default values. These MUST be in the .env file.
  DB_DIALECT: process.env.DB_DIALECT,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,

  // Other services
  RABBITMQ_URL: process.env.RABBITMQ_URL,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  GRAPHQL_ENABLED: process.env.GRAPHQL_ENABLED === 'true', // Correctly handle boolean
};