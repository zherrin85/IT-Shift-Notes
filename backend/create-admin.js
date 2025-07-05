// create-admin.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const readline = require('readline');

const saltRounds = 10;

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'shiftnotes_user',
    password: 'PASSWORD_HERE',
    database: 'it_shift_notes',
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function createAdmin() {
    console.log('--- Create Initial Admin User ---');

    const email = await new Promise(resolve => {
        rl.question('Enter admin email: ', resolve);
    });

    const password = await new Promise(resolve => {
        rl.question('Enter admin password: ', resolve);
    });

    const name = await new Promise(resolve => {
        rl.question('Enter admin full name: ', resolve);
    });

    if (!email || !password || !name) {
        console.error('Email, password, and name are required.');
        rl.close();
        return;
    }

    try {
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const id = crypto.randomUUID();

        console.log('Inserting user into the database...');
        await pool.execute(
            'INSERT INTO users (id, name, email, role, password, avatar) VALUES (?, ?, ?, ?, ?, ?)',
            [id, name, email, 'Administrator', hashedPassword, name.substring(0,2).toUpperCase()]
        );

        console.log('\n✅ Success! Admin user created.');
        console.log(`   Email: ${email}`);
        console.log('You can now log in with these credentials.');

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.error('\n❌ Error: A user with this email already exists.');
        } else {
            console.error('\n❌ An error occurred:', error);
        }
    } finally {
        rl.close();
        await pool.end();
    }
}

createAdmin();
