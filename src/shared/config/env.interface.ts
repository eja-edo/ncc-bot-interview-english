export interface EnvConfig {
  NODE_ENV: "development" | "production" | "test";
  AGENT_BASE_URL: string;
  MEZON_TOKEN: string;
  MEZON_BOT_ID: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  MINIO_ENDPOINT: string;
  MINIO_BUCKET: string;
}
