-- InsurePress Studio — MySQL 8.0 schema
-- Applied by `npm run migrate` (server/db/migrate.js). Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  brokerage_name VARCHAR(190) NULL,
  naicom_license_no VARCHAR(80) NULL,
  role ENUM('admin','author') NOT NULL DEFAULT 'author',
  token_version INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  primary_color VARCHAR(9) NOT NULL DEFAULT '#0F2942',
  secondary_color VARCHAR(9) NOT NULL DEFAULT '#334155',
  accent_color VARCHAR(9) NOT NULL DEFAULT '#D97706',
  heading_font VARCHAR(80) NOT NULL DEFAULT 'Merriweather',
  body_font VARCHAR(80) NOT NULL DEFAULT 'Inter',
  logo_url TEXT NULL,
  author_photo_url TEXT NULL,
  regulatory_framework VARCHAR(255) NOT NULL DEFAULT 'NAICOM & Nigerian Insurance Industry Reform Act 2025',
  default_currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  default_disclaimer TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_brand_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  brand_kit_id INT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(500) NULL,
  author_name VARCHAR(160) NULL,
  target_persona VARCHAR(255) NULL,
  core_pain_point TEXT NULL,
  monetization_goal ENUM('direct_sales','lead_generation','hybrid') NOT NULL DEFAULT 'hybrid',
  price_amount DECIMAL(12,2) NOT NULL DEFAULT 7500.00,
  currency ENUM('NGN','USD') NOT NULL DEFAULT 'NGN',
  trim_size ENUM('5.5x8.5','6x9','A5','A4') NOT NULL DEFAULT '6x9',
  theme_preset VARCHAR(40) NOT NULL DEFAULT 'executive-navy',
  cover_config_json JSON NULL,
  status ENUM('draft','review','published') NOT NULL DEFAULT 'draft',
  target_word_count INT NOT NULL DEFAULT 30000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_book_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_book_brand FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chapters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  section_type ENUM('front_matter','body','workbook','back_matter') NOT NULL DEFAULT 'body',
  matter_subtype VARCHAR(40) NOT NULL DEFAULT 'chapter',
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  content_json JSON NULL,
  content_html MEDIUMTEXT NULL,
  word_count INT NOT NULL DEFAULT 0,
  status ENUM('outline','drafting','polishing','complete') NOT NULL DEFAULT 'outline',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chapters_book (book_id, section_type, sort_order),
  CONSTRAINT fk_chapter_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chapter_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chapter_id INT NOT NULL,
  version_label VARCHAR(160) NOT NULL,
  content_json JSON NULL,
  word_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_versions_chapter (chapter_id, created_at),
  CONSTRAINT fk_version_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pain_point_blueprints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NULL,
  audience_segment VARCHAR(190) NOT NULL,
  pain_points_json JSON NULL,
  recommended_policies_json JSON NULL,
  generated_outline_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_blueprint_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monetization_ctas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  label VARCHAR(190) NOT NULL,
  cta_type ENUM('selar_checkout','paystack_link','whatsapp_quote','policy_audit','calculator','lead_magnet') NOT NULL,
  destination_url TEXT NOT NULL,
  whatsapp_prefill_text TEXT NULL,
  promo_code VARCHAR(60) NULL,
  qr_data_url MEDIUMTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cta_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS export_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  format ENUM('pdf','epub','docx','lead_magnet_pdf') NOT NULL,
  file_path VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_export_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Single-use password reset links. Only a SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  requested_ip VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resets_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
