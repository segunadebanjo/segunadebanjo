-- AlterTable
ALTER TABLE `users` ADD COLUMN `totp_last_step` INTEGER NULL,
    ADD COLUMN `totp_pending_secret_enc` VARCHAR(255) NULL,
    ADD COLUMN `totp_secret_enc` VARCHAR(255) NULL,
    ADD COLUMN `two_factor_enabled_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `two_factor_recovery_codes` (
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
