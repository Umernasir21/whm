-- =====================================================================
--  WMS — MySQL 8 Schema (Phase 1: documented core)
--  Charset utf8mb4, InnoDB, money in integer cents.
--  This is the reference DDL; Laravel migrations generate the same shape.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
--  AUTH & RBAC
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(64)  NOT NULL,
  label         VARCHAR(128) NOT NULL,
  created_at    TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permissions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(96) NOT NULL,          -- e.g. sales_orders.create
  label         VARCHAR(128) NOT NULL,
  created_at    TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_permission (
  role_id       BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id        BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(128) NOT NULL,
  email          VARCHAR(191) NOT NULL,
  email_verified_at TIMESTAMP NULL,
  password       VARCHAR(255) NOT NULL,
  remember_token VARCHAR(100) NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  deleted_at     TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sanctum personal access tokens
CREATE TABLE personal_access_tokens (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tokenable_type VARCHAR(255) NOT NULL,
  tokenable_id   BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(255) NOT NULL,
  token          VARCHAR(64) NOT NULL,
  abilities      TEXT NULL,
  last_used_at   TIMESTAMP NULL,
  expires_at     TIMESTAMP NULL,
  created_at     TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pat_token (token),
  KEY idx_pat_tokenable (tokenable_type, tokenable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  ATOMIC SEQUENCES (SO-00001, PO-00001, INV-00001)
-- ---------------------------------------------------------------------
CREATE TABLE sequences (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  key_name    VARCHAR(32) NOT NULL,   -- 'sales_order' | 'purchase_order' | 'invoice'
  prefix      VARCHAR(8)  NOT NULL,   -- 'SO-' | 'PO-' | 'INV-'
  next_value  BIGINT UNSIGNED NOT NULL DEFAULT 1,
  pad_length  TINYINT UNSIGNED NOT NULL DEFAULT 5,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sequences_key (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  PARTIES: customers & vendors
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name      VARCHAR(96)  NOT NULL,
  last_name       VARCHAR(96)  NULL,
  complete_name   VARCHAR(191) NULL,          -- "username" in the screenshot
  company_name    VARCHAR(191) NULL,
  email           VARCHAR(191) NOT NULL,
  phone           VARCHAR(48)  NULL,
  buyer_id        VARCHAR(96)  NULL,          -- external marketplace buyer id
  -- shipping details (Figure 3)
  shipping_name     VARCHAR(191) NULL,
  shipping_address1 VARCHAR(191) NULL,
  shipping_address2 VARCHAR(191) NULL,
  shipping_city     VARCHAR(96)  NULL,
  shipping_state    VARCHAR(96)  NULL,
  shipping_zip      VARCHAR(24)  NULL,
  shipping_country  VARCHAR(96)  NULL,
  created_at      TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  deleted_at      TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_customers_email (email),
  KEY idx_customers_name (first_name, last_name),
  FULLTEXT KEY ft_customers (first_name, last_name, complete_name, company_name, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendors (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(191) NOT NULL,
  email         VARCHAR(191) NULL,
  phone         VARCHAR(48)  NULL,
  address1      VARCHAR(191) NULL,
  city          VARCHAR(96)  NULL,
  state         VARCHAR(96)  NULL,
  zip           VARCHAR(24)  NULL,
  country       VARCHAR(96)  NULL,
  created_at    TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  deleted_at    TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_vendors_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  PRODUCTS (light in P1; inventory-ready)
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku           VARCHAR(64)  NOT NULL,
  name          VARCHAR(191) NOT NULL,
  description   TEXT NULL,
  default_price_cents BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  deleted_at    TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  SALES ORDERS
-- ---------------------------------------------------------------------
CREATE TABLE sales_orders (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  so_number         VARCHAR(24) NOT NULL,         -- SO-00001
  customer_id       BIGINT UNSIGNED NOT NULL,
  order_type        ENUM('regular','dropship') NOT NULL DEFAULT 'regular',
  status            ENUM('draft','confirmed','shipped','delivered','cancelled')
                      NOT NULL DEFAULT 'draft',
  -- resource / marketplace linkage (Figure 1)
  resource          VARCHAR(96) NULL,
  resource_order_id VARCHAR(96) NULL,
  alternate_id      VARCHAR(96) NULL,
  -- payment (Figure 1)
  payment_method    VARCHAR(64) NULL,
  transaction_id    VARCHAR(96) NULL,
  payment_date      DATE NULL,
  payment_comment   VARCHAR(255) NULL,
  -- money (cents)
  subtotal_cents    BIGINT NOT NULL DEFAULT 0,   -- Σ line totals
  shipping_cents    BIGINT NOT NULL DEFAULT 0,
  tax_cents         BIGINT NOT NULL DEFAULT 0,
  grand_total_cents BIGINT NOT NULL DEFAULT 0,
  linked_po_id      BIGINT UNSIGNED NULL,        -- for profit attribution
  created_by        BIGINT UNSIGNED NULL,
  created_at        TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  deleted_at        TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_so_number (so_number),
  KEY idx_so_customer (customer_id),
  KEY idx_so_status (status),
  KEY idx_so_created (created_at),
  CONSTRAINT fk_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_so_creator  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sales_order_items (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sales_order_id  BIGINT UNSIGNED NOT NULL,
  product_id      BIGINT UNSIGNED NULL,
  product_name    VARCHAR(191) NOT NULL,         -- denormalized snapshot
  condition        ENUM('new','used','refurbished') NOT NULL DEFAULT 'new',
  line_type       ENUM('ds','rg') NOT NULL DEFAULT 'rg',  -- Ds/Rg from Figure 1
  quantity        INT UNSIGNED NOT NULL DEFAULT 1,
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  line_total_cents BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_soi_order (sales_order_id),
  CONSTRAINT fk_soi_order   FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_soi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  SHIPMENTS  (Figure 8: carrier / tracking / status)
-- ---------------------------------------------------------------------
CREATE TABLE shipments (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sales_order_id  BIGINT UNSIGNED NOT NULL,
  carrier         ENUM('USPS','UPS','FedEx') NULL,
  tracking_number VARCHAR(96) NULL,
  status          ENUM('pending','shipped','delivered') NOT NULL DEFAULT 'pending',
  -- default ship-from (Figure 9 doc block)
  ship_from_name    VARCHAR(191) NULL,
  ship_from_address VARCHAR(191) NULL DEFAULT '21043 Warrender Terrace Ln',
  ship_from_city    VARCHAR(96)  NULL DEFAULT 'Richmond',
  ship_from_state   VARCHAR(32)  NULL DEFAULT 'TX',
  ship_from_zip     VARCHAR(16)  NULL DEFAULT '77407',
  shipped_at      TIMESTAMP NULL,
  delivered_at    TIMESTAMP NULL,
  created_at      TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shipment_order (sales_order_id),
  KEY idx_shipment_tracking (tracking_number),
  CONSTRAINT fk_shipment_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  INVOICES  (Figure 9 template)
-- ---------------------------------------------------------------------
CREATE TABLE invoices (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_number  VARCHAR(24) NOT NULL,          -- INV-00001
  sales_order_id  BIGINT UNSIGNED NOT NULL,
  issued_date     DATE NOT NULL,
  subtotal_cents  BIGINT NOT NULL DEFAULT 0,
  tax_cents       BIGINT NOT NULL DEFAULT 0,
  shipping_cents  BIGINT NOT NULL DEFAULT 0,
  total_cents     BIGINT NOT NULL DEFAULT 0,
  pdf_path        VARCHAR(255) NULL,
  created_at      TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_number (invoice_number),
  UNIQUE KEY uq_invoice_order (sales_order_id),
  CONSTRAINT fk_invoice_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
--  PURCHASE ORDERS  (Figure 10)
-- ---------------------------------------------------------------------
CREATE TABLE purchase_orders (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  po_number         VARCHAR(24) NOT NULL,        -- PO-00001
  vendor_id         BIGINT UNSIGNED NULL,
  status            ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  subtotal_cents    BIGINT NOT NULL DEFAULT 0,
  tax_cents         BIGINT NOT NULL DEFAULT 0,   -- buying/purchase tax
  grand_total_cents BIGINT NOT NULL DEFAULT 0,
  ordered_date      DATE NULL,
  created_by        BIGINT UNSIGNED NULL,
  created_at        TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  deleted_at        TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_number (po_number),
  KEY idx_po_vendor (vendor_id),
  KEY idx_po_status (status),
  CONSTRAINT fk_po_vendor  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
  CONSTRAINT fk_po_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchase_order_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id  BIGINT UNSIGNED NOT NULL,
  product_id         BIGINT UNSIGNED NULL,
  product_name       VARCHAR(191) NOT NULL,
  condition           ENUM('new','used','refurbished') NOT NULL DEFAULT 'new',
  quantity           INT UNSIGNED NOT NULL DEFAULT 1,
  unit_cost_cents    BIGINT NOT NULL DEFAULT 0,
  tax_cents          BIGINT NOT NULL DEFAULT 0,
  line_total_cents   BIGINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_poi_order (purchase_order_id),
  CONSTRAINT fk_poi_order   FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- link SO -> PO for profit attribution (added after both exist)
ALTER TABLE sales_orders
  ADD CONSTRAINT fk_so_linked_po FOREIGN KEY (linked_po_id)
  REFERENCES purchase_orders(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
--  AUDIT LOG
-- ---------------------------------------------------------------------
CREATE TABLE activity_log (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NULL,
  action        VARCHAR(32) NOT NULL,            -- created|updated|deleted
  subject_type  VARCHAR(96) NOT NULL,            -- App\Models\SalesOrder
  subject_id    BIGINT UNSIGNED NOT NULL,
  changes_json  JSON NULL,
  ip_address    VARCHAR(45) NULL,
  created_at    TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_activity_subject (subject_type, subject_id),
  KEY idx_activity_user (user_id),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
