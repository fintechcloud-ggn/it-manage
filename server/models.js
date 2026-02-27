const db = require('./db');
const bcrypt = require('bcryptjs');

function init() {
  // lowdb already ensures the file and defaults; nothing else to do here
}

function nextId(collection) {
  const items = db.get(collection).value();
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

function seedSample() {
  if (db.get('users').size().value() === 0) {
    const adminPassword = bcrypt.hashSync('admin', 8);
    const userPassword = bcrypt.hashSync('password', 8);
    db.get('users').push({ id: nextId('users'), name: 'Admin', email: 'admin', role: 'admin', password: adminPassword }).write();
    db.get('users').push({ id: nextId('users'), name: 'Bob Engineer', email: 'bob@example.com', role: 'user', password: userPassword }).write();
  }

  if (db.get('stores').size().value() === 0) {
    db.get('stores').push({ id: nextId('stores'), name: 'Main Warehouse', location: 'Head Office' }).write();
  }

  if (db.get('assets').size().value() === 0) {
    db.get('assets').push({ id: nextId('assets'), name: 'Dell Laptop', type: 'Laptop', serial: 'DL-1001', status: 'available', store_id: 1, notes: '15-inch' }).write();
    db.get('assets').push({ id: nextId('assets'), name: 'Logitech Mouse', type: 'Peripheral', serial: 'LM-200', status: 'available', store_id: 1, notes: 'Wireless' }).write();
  }
}

module.exports = { init, seedSample };
