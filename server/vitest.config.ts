import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env: { DISABLE_CRON: 'true', SANDBOX_MODE: 'true', WEBHOOK_SECRET_KEY: 'test-secret', MAIL_TRANSPORT: 'memory', APP_URL: 'https://ads.example.test', REQUIRE_2FA_ROLES: 'none' },
  },
});
