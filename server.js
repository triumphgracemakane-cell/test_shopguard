const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./shop.db', (err) => {
    if (err) console.error('Database opening error: ', err.message);
    else console.log('Connected to SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS shops (
        phone TEXT PRIMARY KEY,
        shop_name TEXT,
        email TEXT,
        pin TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_phone TEXT,
        name TEXT,
        phone TEXT,
        amount REAL,
        type TEXT
    )`);
});

// Register shop
app.post('/api/shops/register', (req, res) => {
    const { shop_name, email, phone, pin } = req.body;
    db.run(`INSERT INTO shops (phone, shop_name, email, pin) VALUES (?, ?, ?, ?)`, 
        [phone, shop_name, email, pin], function(err) {
        if (err) {
            return res.status(400).json({ error: 'Phone number already registered.' });
        }
        res.json({ success: true, shop: { shop_name, email, phone } });
    });
});

// Sign in
app.post('/api/shops/signin', (req, res) => {
    const { phone, pin } = req.body;
    db.get(`SELECT * FROM shops WHERE phone = ? AND pin = ?`, [phone, pin], (err, shop) => {
        if (err || !shop) {
            return res.status(401).json({ error: 'Incorrect phone number or PIN.' });
        }
        res.json({ success: true, shop });
    });
});

// Real PIN Recovery (Generates a new random 4-digit PIN)
app.post('/api/shops/recover', (req, res) => {
    const { email } = req.body;
    db.get(`SELECT * FROM shops WHERE email = ?`, [email], (err, shop) => {
        if (err || !shop) {
            return res.status(404).json({ error: 'Email not found in records.' });
        }
        // Generate a real random 4-digit PIN
        const newPin = Math.floor(1000 + Math.random() * 9000).toString();
        db.run(`UPDATE shops SET pin = ? WHERE email = ?`, [newPin, email], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ error: 'Failed to update recovery PIN.' });
            }
            res.json({ success: true, message: `Recovery successful! Your new 4-digit PIN is: ${newPin}. Please write it down.` });
        });
    });
});

// Get entries for a shop
app.get('/api/entries/:shop_phone', (req, res) => {
    db.all(`SELECT * FROM entries WHERE shop_phone = ?`, [req.params.shop_phone], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add entry
app.post('/api/entries', (req, res) => {
    const { shop_phone, name, phone, amount, type } = req.body;
    db.run(`INSERT INTO entries (shop_phone, name, phone, amount, type) VALUES (?, ?, ?, ?, ?)`,
        [shop_phone, name, phone, amount, type], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// Delete entry (Settle debt)
app.delete('/api/entries/:id', (req, res) => {
    db.run(`DELETE FROM entries WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});