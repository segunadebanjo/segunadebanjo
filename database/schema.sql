-- Insurance Ad Manager — raw MySQL 8.0 schema backup.
-- Mirrors server/prisma/migrations/* (in order). Apply with:
--   mysql -u root -p < database/schema.sql      (or: cd server && npm run db:apply-sql)
-- Use this OR Prisma migrations on a given database, not both.

CREATE DATABASE IF NOT EXISTS `insurance_ads` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `insurance_ads`;
SET FOREIGN_KEY_CHECKS = 0;

-- ===== 20261116110856_init =====
-- CreateTable
CREATE TABLE IF NOT EXISTS `insurance_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `insurance_class` ENUM('AUTO_MOTOR', 'HEALTH_HMO', 'LIFE', 'PROPERTY', 'COMMERCIAL_SME', 'TRAVEL') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `target_audience_summary` TEXT NOT NULL,
    `key_benefits` JSON NOT NULL,
    `starting_premium` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'NGN',
    `landing_page_url` VARCHAR(500) NOT NULL,
    `regulatory_license_number` VARCHAR(80) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `insurance_products_insurance_class_idx`(`insurance_class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `campaigns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `objective` ENUM('TRAFFIC', 'QUOTE_LEADS', 'POLICY_PURCHASE') NOT NULL,
    `total_daily_budget` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'NGN',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PAUSED', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `target_locations` JSON NOT NULL,
    `special_ad_category` VARCHAR(64) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `campaigns_utm_campaign_key`(`utm_campaign`),
    INDEX `campaigns_product_id_idx`(`product_id`),
    INDEX `campaigns_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `platform_deployments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` INTEGER NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN') NOT NULL,
    `variant_id` INTEGER NULL,
    `external_campaign_id` VARCHAR(128) NULL,
    `external_adset_id` VARCHAR(128) NULL,
    `external_ad_id` VARCHAR(128) NULL,
    `daily_budget` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'NOT_PUBLISHED',
    `last_error` TEXT NULL,
    `last_synced_at` DATETIME(3) NULL,

    INDEX `platform_deployments_campaign_id_idx`(`campaign_id`),
    INDEX `platform_deployments_variant_id_idx`(`variant_id`),
    UNIQUE INDEX `platform_deployments_campaign_id_platform_key`(`campaign_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ad_creative_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` INTEGER NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN') NOT NULL,
    `hook_angle` VARCHAR(160) NOT NULL,
    `headlines` JSON NOT NULL,
    `primary_texts` JSON NOT NULL,
    `descriptions` JSON NOT NULL,
    `call_to_action` VARCHAR(40) NOT NULL,
    `media_brief_or_url` TEXT NULL,
    `keywords` JSON NULL,
    `targeting_suggestions` JSON NULL,
    `compliance_status` ENUM('PASSED', 'WARNING', 'BLOCKED') NOT NULL DEFAULT 'WARNING',
    `compliance_notes` JSON NOT NULL,
    `is_selected` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ad_creative_variants_campaign_id_idx`(`campaign_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `conversion_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_event_id` VARCHAR(128) NULL,
    `click_id` VARCHAR(255) NULL,
    `click_id_type` VARCHAR(16) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `campaign_id` INTEGER NULL,
    `deployment_id` INTEGER NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'LINKEDIN') NULL,
    `event_type` ENUM('QUOTE_STARTED', 'APPLICATION_SUBMITTED', 'POLICY_PURCHASED') NOT NULL,
    `policy_premium_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'NGN',
    `hashed_email` VARCHAR(64) NULL,
    `dispatched_to_platforms` BOOLEAN NOT NULL DEFAULT false,
    `dispatch_results` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conversion_events_external_event_id_key`(`external_event_id`),
    INDEX `conversion_events_click_id_idx`(`click_id`),
    INDEX `conversion_events_campaign_id_idx`(`campaign_id`),
    INDEX `conversion_events_deployment_id_idx`(`deployment_id`),
    INDEX `conversion_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `performance_metrics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deployment_id` INTEGER NOT NULL,
    `metric_date` DATE NOT NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `spend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `quotes_started` INTEGER NOT NULL DEFAULT 0,
    `policies_sold` INTEGER NOT NULL DEFAULT 0,
    `revenue_generated` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    INDEX `performance_metrics_metric_date_idx`(`metric_date`),
    UNIQUE INDEX `performance_metrics_deployment_id_metric_date_key`(`deployment_id`, `metric_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `optimization_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(160) NOT NULL,
    `rule_type` ENUM('PAUSE_ZERO_QUOTES', 'SCALE_HIGH_ROAS', 'FLAG_HIGH_CPA') NOT NULL,
    `spend_threshold` DECIMAL(12, 2) NULL,
    `target_roas` DECIMAL(8, 2) NULL,
    `max_cost_per_policy` DECIMAL(12, 2) NULL,
    `budget_increase_pct` INTEGER NOT NULL DEFAULT 15,
    `lookback_days` INTEGER NOT NULL DEFAULT 7,
    `mode` ENUM('RECOMMEND', 'AUTO_APPLY') NOT NULL DEFAULT 'RECOMMEND',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `optimization_recommendations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rule_id` INTEGER NOT NULL,
    `deployment_id` INTEGER NOT NULL,
    `action` ENUM('PAUSE', 'INCREASE_BUDGET', 'FLAG') NOT NULL,
    `reason` TEXT NOT NULL,
    `suggested_budget` DECIMAL(12, 2) NULL,
    `metrics_snapshot` JSON NOT NULL,
    `status` ENUM('OPEN', 'APPLIED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `optimization_recommendations_rule_id_idx`(`rule_id`),
    INDEX `optimization_recommendations_deployment_id_idx`(`deployment_id`),
    INDEX `optimization_recommendations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `insurance_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_deployments` ADD CONSTRAINT `platform_deployments_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_deployments` ADD CONSTRAINT `platform_deployments_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `ad_creative_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ad_creative_variants` ADD CONSTRAINT `ad_creative_variants_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversion_events` ADD CONSTRAINT `conversion_events_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversion_events` ADD CONSTRAINT `conversion_events_deployment_id_fkey` FOREIGN KEY (`deployment_id`) REFERENCES `platform_deployments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_metrics` ADD CONSTRAINT `performance_metrics_deployment_id_fkey` FOREIGN KEY (`deployment_id`) REFERENCES `platform_deployments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `optimization_recommendations` ADD CONSTRAINT `optimization_recommendations_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `optimization_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `optimization_recommendations` ADD CONSTRAINT `optimization_recommendations_deployment_id_fkey` FOREIGN KEY (`deployment_id`) REFERENCES `platform_deployments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== 20261116115429_add_users =====
-- CreateTable
CREATE TABLE IF NOT EXISTS `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'MARKETER', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `token_version` INTEGER NOT NULL DEFAULT 0,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ===== 20261116120342_password_reset_tokens =====
-- CreateTable
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `requested_ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== 20261116120833_two_factor_auth =====
-- AlterTable
ALTER TABLE `users` ADD COLUMN `totp_last_step` INTEGER NULL,
    ADD COLUMN `totp_pending_secret_enc` VARCHAR(255) NULL,
    ADD COLUMN `totp_secret_enc` VARCHAR(255) NULL,
    ADD COLUMN `two_factor_enabled_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS `two_factor_recovery_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `code_hash` CHAR(64) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `two_factor_recovery_codes_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `two_factor_recovery_codes` ADD CONSTRAINT `two_factor_recovery_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
