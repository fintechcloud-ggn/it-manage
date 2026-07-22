require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change_this_secret';
const token = jwt.sign({ id: 10, email: 'anant.sharma@yopmail.com' }, SECRET, { expiresIn: '1d' });
console.log('Token:', token);
