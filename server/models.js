const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function init() {
  await query(`
    CREATE TABLE IF NOT EXISTS brands (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_models (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brand_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(60) NOT NULL DEFAULT 'Laptop',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_brand_model (brand_id, name),
      CONSTRAINT fk_models_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      role VARCHAR(30) NOT NULL DEFAULT 'user',
      profile_image_url VARCHAR(500) NULL,
      permissions_json TEXT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      location VARCHAR(160) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      type VARCHAR(100) NOT NULL,
      brand_id INT NULL,
      model_id INT NULL,
      serial VARCHAR(180) NOT NULL UNIQUE,
      status VARCHAR(30) NOT NULL DEFAULT 'available',
      store_id INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_assets_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
      CONSTRAINT fk_assets_model FOREIGN KEY (model_id) REFERENCES asset_models(id) ON DELETE SET NULL,
      CONSTRAINT fk_assets_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS allocations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asset_id INT NOT NULL,
      user_id INT NOT NULL,
      allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      allocated_at_ms BIGINT NULL,
      returned_at DATETIME NULL,
      returned_at_ms BIGINT NULL,
      notes TEXT NULL,
      CONSTRAINT fk_alloc_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      CONSTRAINT fk_alloc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_user_id INT NULL,
      actor_name VARCHAR(120) NULL,
      actor_role VARCHAR(30) NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT NULL,
      details TEXT NULL,
      event_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      event_at_ms BIGINT NULL,
      INDEX idx_audit_event_at (event_at),
      INDEX idx_audit_action (action),
      CONSTRAINT fk_audit_actor_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  // Backward-compatible migration for existing databases.
  const allocMsCol = await query("SHOW COLUMNS FROM allocations LIKE 'allocated_at_ms'");
  if (!allocMsCol.length) {
    await query('ALTER TABLE allocations ADD COLUMN allocated_at_ms BIGINT NULL AFTER allocated_at');
  }
  const returnMsCol = await query("SHOW COLUMNS FROM allocations LIKE 'returned_at_ms'");
  if (!returnMsCol.length) {
    await query('ALTER TABLE allocations ADD COLUMN returned_at_ms BIGINT NULL AFTER returned_at');
  }

  const auditMsCol = await query("SHOW COLUMNS FROM audit_logs LIKE 'event_at_ms'");
  if (!auditMsCol.length) {
    await query('ALTER TABLE audit_logs ADD COLUMN event_at_ms BIGINT NULL AFTER event_at');
  }
  const userProfileImageCol = await query("SHOW COLUMNS FROM users LIKE 'profile_image_url'");
  if (!userProfileImageCol.length) {
    await query('ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL AFTER role');
  }
  const userPermissionsCol = await query("SHOW COLUMNS FROM users LIKE 'permissions_json'");
  if (!userPermissionsCol.length) {
    await query('ALTER TABLE users ADD COLUMN permissions_json TEXT NULL AFTER profile_image_url');
  }
}

async function seedSample() {
  const adminEmail = 'admin';
  const defaultUserEmail = 'bob@example.com';

  const users = await query('SELECT id FROM users LIMIT 1');
  if (users.length === 0) {
    const adminPassword = bcrypt.hashSync('admin', 8);
    const userPassword = bcrypt.hashSync('password', 8);
    await query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', ['Admin', adminEmail, 'admin', adminPassword]);
    await query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', ['Bob Engineer', defaultUserEmail, 'user', userPassword]);
  }

  const stores = await query('SELECT id FROM stores LIMIT 1');
  if (stores.length === 0) {
    await query('INSERT INTO stores (name, location) VALUES (?, ?)', ['Main Warehouse', 'Head Office']);
  }

  const modelCatalog = {
    Apple: [
      { name: 'MacBook Air M2', category: 'Laptop' },
      { name: 'MacBook Air M3', category: 'Laptop' },
      { name: 'MacBook Pro 14 M3', category: 'Laptop' },
      { name: 'MacBook Pro 16 M3', category: 'Laptop' },
      { name: 'MacBook Pro 16 M2', category: 'Laptop' },
      { name: 'MacBook Pro 16 M2', category: 'Laptop' },
      { name: 'MacBook Pro 16 M1', category: 'Laptop' },
      { name: 'MacBook Pro 16 M4', category: 'Laptop' },
      { name: 'MacBook Pro 16 M5', category: 'Laptop' },
      { name: 'iPad Pro', category: 'Tablet' },
      { name: 'iPhone', category: 'Mobile' },
    ],
    Dell: [
      { name: 'Latitude 5440', category: 'Laptop' },
      { name: 'Latitude 7440', category: 'Laptop' },
      { name: 'XPS 13', category: 'Laptop' },
      { name: 'Precision 3580', category: 'Desktop' },
      { name: 'UltraSharp 27', category: 'Monitor' },
    ],
    HP: [
      { name: 'EliteBook 840 G10', category: 'Laptop' },
      { name: 'ProBook 440 G10', category: 'Laptop' },
      { name: 'ZBook Firefly 14', category: 'Laptop' },
      { name: 'LaserJet Pro', category: 'Printer' },
      { name: 'ScanJet', category: 'Scanner' },
    ],
    Lenovo: [
      { name: 'ThinkPad T14 Gen 4', category: 'Laptop' },
      { name: 'ThinkPad X1 Carbon Gen 11', category: 'Laptop' },
      { name: 'ThinkPad E14 Gen 5', category: 'Laptop' },
      { name: 'ThinkCentre M90', category: 'Desktop' },
    ],
    Acer: [
      { name: 'TravelMate P4', category: 'Laptop' },
      { name: 'Swift Go 14', category: 'Laptop' },
    ],
    Asus: [
      { name: 'ExpertBook B9', category: 'Laptop' },
      { name: 'Zenbook 14 OLED', category: 'Laptop' },
    ],
    Samsung: [
      { name: 'Galaxy S24', category: 'Mobile' },
      { name: 'Galaxy S24 Ultra', category: 'Mobile' },
      { name: 'Galaxy Z Fold5', category: 'Mobile' },
      { name: 'Galaxy Tab S9', category: 'Tablet' },
      { name: 'Smart Monitor M8', category: 'Monitor' },
    ],
    Google: [
      { name: 'Pixel 8', category: 'Mobile' },
      { name: 'Pixel 8 Pro', category: 'Mobile' },
      { name: 'Pixel Tablet', category: 'Tablet' },
    ],
    OnePlus: [
      { name: 'OnePlus 12', category: 'Mobile' },
      { name: 'OnePlus Open', category: 'Mobile' },
    ],
    Xiaomi: [
      { name: 'Xiaomi 14', category: 'Mobile' },
      { name: 'Redmi Note 13', category: 'Mobile' },
      { name: 'Pad 6', category: 'Tablet' },
    ],
    Oppo: [
      { name: 'Find X7', category: 'Mobile' },
      { name: 'Reno 11', category: 'Mobile' },
    ],
    Vivo: [
      { name: 'V30', category: 'Mobile' },
      { name: 'X100', category: 'Mobile' },
    ],
    iQOO: [
      { name: 'iQOO 12', category: 'Mobile' },
      { name: 'iQOO Neo 9', category: 'Mobile' },
    ],
    Motorola: [
      { name: 'Moto Edge 50', category: 'Mobile' },
      { name: 'Razr 50', category: 'Mobile' },
    ],
    Realme: [
      { name: 'Realme GT 6', category: 'Mobile' },
      { name: 'Realme 12 Pro', category: 'Mobile' },
      { name: 'Narzo 70', category: 'Mobile' },
    ],
    POCO: [
      { name: 'POCO X6 Pro', category: 'Mobile' },
      { name: 'POCO M6 Pro', category: 'Mobile' },
    ],
    Redmi: [
      { name: 'Redmi Note 13 Pro', category: 'Mobile' },
      { name: 'Redmi 13C', category: 'Mobile' },
    ],
    Infinix: [
      { name: 'Infinix Note 40', category: 'Mobile' },
      { name: 'Infinix Zero 30', category: 'Mobile' },
      { name: 'Infinix Smart 8', category: 'Mobile' },
    ],
    Tecno: [
      { name: 'Tecno Camon 30', category: 'Mobile' },
      { name: 'Tecno Spark 20', category: 'Mobile' },
      { name: 'Tecno Pova 6', category: 'Mobile' },
    ],
    itel: [
      { name: 'itel P55', category: 'Mobile' },
      { name: 'itel A70', category: 'Mobile' },
    ],
    Lava: [
      { name: 'Lava Agni 2', category: 'Mobile' },
      { name: 'Lava Blaze 5G', category: 'Mobile' },
      { name: 'Lava Yuva 3', category: 'Mobile' },
    ],
    Micromax: [
      { name: 'Micromax IN Note', category: 'Mobile' },
      { name: 'Micromax IN 2C', category: 'Mobile' },
    ],
    Karbonn: [
      { name: 'Karbonn K9 Smart', category: 'Mobile' },
    ],
    Nokia: [
      { name: 'Nokia G42', category: 'Mobile' },
      { name: 'Nokia T21', category: 'Tablet' },
    ],
    Microsoft: [
      { name: 'Surface Laptop 6', category: 'Laptop' },
      { name: 'Surface Pro 10', category: 'Tablet' },
    ],
    LG: [
      { name: 'UltraFine 27', category: 'Monitor' },
      { name: 'UltraGear 32', category: 'Monitor' },
    ],
    BenQ: [
      { name: 'PD2705U', category: 'Monitor' },
      { name: 'EW3270U', category: 'Monitor' },
    ],
    Canon: [
      { name: 'imageCLASS MF3010', category: 'Printer' },
      { name: 'CanoScan LiDE 300', category: 'Scanner' },
    ],
    Epson: [
      { name: 'EcoTank L3250', category: 'Printer' },
      { name: 'WorkForce DS-530', category: 'Scanner' },
    ],
    Brother: [
      { name: 'DCP-L2541DW', category: 'Printer' },
      { name: 'ADS-2200', category: 'Scanner' },
    ],
    Xerox: [
      { name: 'B225 MFP', category: 'Printer' },
    ],
    Cisco: [
      { name: 'Catalyst 9200', category: 'Network' },
      { name: 'Catalyst 9130', category: 'Network' },
    ],
    Ubiquiti: [
      { name: 'UniFi U6 Pro', category: 'Network' },
      { name: 'UniFi Switch 24', category: 'Network' },
    ],
    'TP-Link': [
      { name: 'Archer AX55', category: 'Network' },
      { name: 'TL-SG2428P', category: 'Network' },
    ],
    Netgear: [
      { name: 'Nighthawk AX8', category: 'Network' },
      { name: 'GS108', category: 'Network' },
    ],
    Juniper: [
      { name: 'EX2300', category: 'Network' },
      { name: 'SRX300', category: 'Network' },
    ],
    'D-Link': [
      { name: 'DIR-X5460', category: 'Network' },
      { name: 'DGS-1210', category: 'Network' },
    ],
    Logitech: [
      { name: 'MX Master 3S', category: 'Peripheral' },
      { name: 'MX Keys', category: 'Peripheral' },
      { name: 'Brio 4K', category: 'Peripheral' },
      { name: 'Zone Vibe 100', category: 'Peripheral' },
    ],
    Razer: [
      { name: 'DeathAdder V3', category: 'Peripheral' },
      { name: 'BlackWidow V4', category: 'Peripheral' },
      { name: 'Kiyo Pro', category: 'Peripheral' },
    ],
    Generic: [
      { name: 'Business Laptop', category: 'Laptop' },
      { name: 'Developer Laptop', category: 'Laptop' },
      { name: 'Ultrabook', category: 'Laptop' },
      { name: 'High config', category: 'Laptop' },
      { name: 'Workstation', category: 'Desktop' },
      { name: 'Office Desktop', category: 'Desktop' },
      { name: '24-inch Monitor', category: 'Monitor' },
      { name: '27-inch Monitor', category: 'Monitor' },
      { name: '32-inch Monitor', category: 'Monitor' },
      { name: '40-inch Monitor', category: 'Monitor' },
      { name: '49-inch Monitor', category: 'Monitor' },
      { name: '55-inch Monitor', category: 'Monitor' },
      { name: '65-inch Monitor', category: 'Monitor' },
      { name: 'Mouse', category: 'Peripheral' },
      { name: 'Keyboard', category: 'Peripheral' },
      { name: 'Headset', category: 'Peripheral' },
      { name: 'Docking Station', category: 'Peripheral' },
      { name: 'External hard drive', category: 'Peripheral' },
      { name: 'USB drive', category: 'Peripheral' },
      { name: 'Webcam', category: 'Peripheral' },
      { name: 'Business Tablet', category: 'Tablet' },
      { name: 'Corporate Mobile', category: 'Mobile' },
      { name: 'Sim card', category: 'Mobile' },
      { name: 'Router', category: 'Network' },
      { name: 'Switch', category: 'Network' },
      { name: 'Access Point', category: 'Network' },
      { name: 'Printer', category: 'Printer' },
      { name: 'Scanner', category: 'Scanner' },
      { name: 'USB hub', category: 'Peripheral' },
      { name: 'USB cable', category: 'Peripheral' },
    ],
  };

  for (const brandName of Object.keys(modelCatalog)) {
    await query('INSERT IGNORE INTO brands (name) VALUES (?)', [brandName]);
  }

  const brands = await query('SELECT id, name FROM brands');
  const brandIdByName = Object.fromEntries(brands.map((b) => [b.name, b.id]));

  for (const [brandName, models] of Object.entries(modelCatalog)) {
    const brandId = brandIdByName[brandName];
    for (const model of models) {
      await query('INSERT IGNORE INTO asset_models (brand_id, name, category) VALUES (?, ?, ?)', [brandId, model.name, model.category || 'Laptop']);
    }
  }

  const assets = await query('SELECT id FROM assets LIMIT 1');
  if (assets.length === 0) {
    const [appleModel] = await query(`SELECT m.id FROM asset_models m JOIN brands b ON b.id = m.brand_id WHERE b.name = 'Apple' LIMIT 1`);
    const [dellModel] = await query(`SELECT m.id FROM asset_models m JOIN brands b ON b.id = m.brand_id WHERE b.name = 'Dell' LIMIT 1`);
    const [appleBrand] = await query(`SELECT id FROM brands WHERE name = 'Apple' LIMIT 1`);
    const [dellBrand] = await query(`SELECT id FROM brands WHERE name = 'Dell' LIMIT 1`);
    const [store] = await query('SELECT id FROM stores LIMIT 1');

    await query(
      `INSERT INTO assets (name, type, brand_id, model_id, serial, status, store_id, notes)
       VALUES (?, ?, ?, ?, ?, 'available', ?, ?)`,
      ['MacBook Air', 'Laptop', appleBrand?.id || null, appleModel?.id || null, 'APL-1001', store?.id || null, 'Finance team'],
    );

    await query(
      `INSERT INTO assets (name, type, brand_id, model_id, serial, status, store_id, notes)
       VALUES (?, ?, ?, ?, ?, 'available', ?, ?)`,
      ['Dell Latitude', 'Laptop', dellBrand?.id || null, dellModel?.id || null, 'DLL-2001', store?.id || null, 'Ops team'],
    );
  }
}

module.exports = { init, seedSample };
