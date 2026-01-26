import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '2982003',
  database: process.env.DB_NAME || 'interview_bot_test',
  entities: [
    'src/database-test/entities/*.entity.ts', 
  ],
  migrations: ['src/database-test/migrations/*.ts'],
  logging: false,
});
