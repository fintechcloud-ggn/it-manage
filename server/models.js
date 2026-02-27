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
      returned_at DATETIME NULL,
      notes TEXT NULL,
      CONSTRAINT fk_alloc_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      CONSTRAINT fk_alloc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
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

  const brandSeed = {
    Apple: ['MacBook Air M2', 'MacBook Air M3', 'MacBook Pro 14 M3', 'MacBook Pro 16 M3'],
    Dell: ['Latitude 5440', 'Latitude 7440', 'XPS 13', 'Precision 3580'],
    HP: ['EliteBook 840 G10', 'ProBook 440 G10', 'ZBook Firefly 14'],
    Lenovo: ['ThinkPad T14 Gen 4', 'ThinkPad X1 Carbon Gen 11', 'ThinkPad E14 Gen 5'],
    Acer: ['TravelMate P4', 'Swift Go 14'],
    Asus: ['ExpertBook B9', 'Zenbook 14 OLED'],
  };

  for (const brandName of Object.keys(brandSeed)) {
    await query('INSERT IGNORE INTO brands (name) VALUES (?)', [brandName]);
  }

  const brands = await query('SELECT id, name FROM brands');
  const brandIdByName = Object.fromEntries(brands.map((b) => [b.name, b.id]));

  for (const [brandName, models] of Object.entries(brandSeed)) {
    const brandId = brandIdByName[brandName];
    for (const modelName of models) {
      await query('INSERT IGNORE INTO asset_models (brand_id, name, category) VALUES (?, ?, ?)', [brandId, modelName, 'Laptop']);
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
