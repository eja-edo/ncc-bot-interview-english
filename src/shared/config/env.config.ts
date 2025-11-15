import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),

  AGENT_BASE_URL: Joi.string().uri().required(),

  MEZON_TOKEN: Joi.string().required(),
  MEZON_BOT_ID: Joi.string().required(),

  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(""),
});
