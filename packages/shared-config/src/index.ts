import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export type BaseEnvironment = z.infer<typeof baseSchema>;

export function parseBaseEnvironment(values: NodeJS.ProcessEnv): BaseEnvironment {
  return baseSchema.parse(values);
}
