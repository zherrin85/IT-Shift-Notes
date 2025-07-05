const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function resetPasswords() {
    const pool = mysql.createPool({
        host: '127.0.0.1',
        user: 'shiftnotes_user',
        password: 'PASSWORD_HERE',
        database: 'it_shift_notes'
    });
    
    try {
        const newHash = await bcrypt.hash('password123', 10);
        console.log('Generated hash:', newHash);
        
        await pool.execute('UPDATE users SET password = ? WHERE email = ?', [newHash, 'admin@company.com']);
        await pool.execute('UPDATE users SET password = ? WHERE email = ?', [newHash, 'john@company.com']);
        await pool.execute('UPDATE users SET password = ? WHERE email = ?', [newHash, 'sarah@company.com']);
        
        console.log('Passwords updated successfully!');
        
        // Test one login
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', ['admin@company.com']);
        const user = users[0];
        const isValid = await bcrypt.compare('password123', user.password);
        console.log('Password validation test:', isValid);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

resetPasswords();
