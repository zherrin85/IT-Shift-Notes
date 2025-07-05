const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const multer = require('multer');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-only-for-dev';
const app = express();
const PORT = 3000;

// Trust proxy headers - IMPORTANT for HTTPS detection behind nginx
app.set('trust proxy', 1);
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
        req.secure = false;
    } else {
        req.secure = true;
    }
    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Keep false - nginx handles HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(cors({
    origin: ['https://zherrin85.duckdns.org', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    }
});

const pool = mysql.createPool({
    host: '127.0.0.1', 
    user: 'shiftnotes_user',
    password: 'PASSWORD_HERE',
    database: 'it_shift_notes',
    waitForConnections: true, 
    connectionLimit: 10, 
    queueLimit: 0
});

// Passport configuration with explicit HTTPS callback
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://zherrin85.duckdns.org/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Safely extract profile data with fallbacks
        const googleId = profile.id || null;
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const name = profile.displayName || profile.name?.givenName || 'Google User';
        const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
        
        if (!email) {
            return done(new Error('No email provided by Google'), null);
        }

        // Check if user exists
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE google_id = ? OR email = ?',
            [googleId, email]
        );

        if (users.length > 0) {
            // Update existing user with Google info
            await pool.execute(
                'UPDATE users SET google_id = ?, google_refresh_token = ?, avatar_url = ? WHERE id = ?',
                [googleId, refreshToken || null, avatarUrl, users[0].id]
            );
            return done(null, { ...users[0], accessToken, refreshToken });
        } else {
            // Create new user with a placeholder password (Google users don't need passwords)
            const placeholderPassword = await bcrypt.hash('google-oauth-user-no-password', 10);
            
            const [result] = await pool.execute(
                'INSERT INTO users (name, email, password, google_id, google_refresh_token, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, email, placeholderPassword, googleId, refreshToken || null, avatarUrl, 'technician']
            );
            
            const newUser = {
                id: result.insertId,
                name: name,
                email: email,
                google_id: googleId,
                role: 'technician',
                avatar_url: avatarUrl,
                accessToken,
                refreshToken
            };
            return done(null, newUser);
        }
    } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
        done(null, users[0]);
    } catch (error) {
        done(error, null);
    }
});

// Google Drive API helper
class DriveManager {
    constructor(accessToken, refreshToken) {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        this.oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    }

    async uploadFile(fileBuffer, filename, mimeType) {
        try {
            const response = await this.drive.files.create({
                requestBody: {
                    name: filename,
                    parents: ['appDataFolder'] // Store in app-specific folder
                },
                media: {
                    mimeType: mimeType,
                    body: fileBuffer
                },
                fields: 'id,name,size,mimeType'
            });
            return response.data;
        } catch (error) {
            console.error('Drive upload error:', error);
            throw error;
        }
    }

    async downloadFile(fileId) {
        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'stream' });
            return response.data;
        } catch (error) {
            console.error('Drive download error:', error);
            throw error;
        }
    }

    async deleteFile(fileId) {
        try {
            await this.drive.files.delete({ fileId });
        } catch (error) {
            console.error('Drive delete error:', error);
            throw error;
        }
    }
}

// Traditional login endpoint (still supported)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                avatar_url: user.avatar_url 
            } 
        });
    } catch (error) { 
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error.' }); 
    }
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file']
}));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Generate JWT token for the user
        const token = jwt.sign({ id: req.user.id, role: req.user.role }, JWT_SECRET, { expiresIn: '8h' });
        
        // Redirect to frontend with token - explicitly use HTTPS
        res.redirect(`https://zherrin85.duckdns.org?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            avatar_url: req.user.avatar_url
        }))}`);
    }
);

// Authentication middleware
const protect = (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const token = bearer.split(' ')[1].trim();
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) { 
        return res.status(401).json({ message: 'Invalid token' }); 
    }
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Apply protection to all /api routes except login
app.use('/api', (req, res, next) => {
    if (req.path === '/login') return next();
    protect(req, res, next);
});

// Users endpoints
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, role, avatar_url FROM users ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single user
app.get('/api/users/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('User fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body;
    
    // Users can only update their own profile unless they're admin
    if (req.user.id != id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'You can only update your own profile' });
    }
    
    // Only admins can change roles
    if (role && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can change user roles' });
    }
    
    try {
        let query = 'UPDATE users SET name = ?, email = ?';
        let params = [name, email];
        
        if (role && req.user.role === 'admin') {
            query += ', role = ?';
            params.push(role);
        }
        
        query += ' WHERE id = ?';
        params.push(id);
        
        await pool.execute(query, params);
        
        // Fetch updated user
        const [users] = await pool.execute('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?', [id]);
        res.json(users[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        console.error('User update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (admin only)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.id == id) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('User deletion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// User registration endpoint (admin only)
app.post('/api/users', requireAdmin, async (req, res) => {
    const { name, email, password, role = 'technician' } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );
        
        res.status(201).json({ 
            id: result.insertId, 
            name, 
            email, 
            role,
            message: 'User created successfully' 
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        console.error('User creation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Notes endpoints with file attachments
app.get('/api/notes', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT n.*, 
                   u1.name as created_by_name
            FROM notes n 
            LEFT JOIN users u1 ON n.created_by = u1.id 
            ORDER BY n.created_at DESC
        `);
        
        // Get file attachments for each note
        for (let note of rows) {
            const [files] = await pool.execute(`
                SELECT fa.*, u.name as uploaded_by_name 
                FROM file_attachments fa
                LEFT JOIN users u ON fa.uploaded_by = u.id
                WHERE fa.note_id = ?
                ORDER BY fa.created_at ASC
            `, [note.id]);
            note.attachments = files;
        }
        
        res.json(rows);
    } catch (error) {
        console.error('Notes fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get notes by user and month
app.get('/api/notes/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { year, month } = req.query;
    
    try {
        let query = `
            SELECT n.*, 
                   u1.name as created_by_name
            FROM notes n 
            LEFT JOIN users u1 ON n.created_by = u1.id 
            WHERE n.created_by = ?`;
        let params = [userId];
        
        if (year && month) {
            query += ` AND YEAR(n.shift_date) = ? AND MONTH(n.shift_date) = ?`;
            params.push(year, month);
        }
        
        query += ` ORDER BY n.shift_date DESC, n.created_at DESC`;
        
        const [rows] = await pool.execute(query, params);
        
        // Get file attachments for each note
        for (let note of rows) {
            const [files] = await pool.execute(`
                SELECT fa.*, u.name as uploaded_by_name 
                FROM file_attachments fa
                LEFT JOIN users u ON fa.uploaded_by = u.id
                WHERE fa.note_id = ?
                ORDER BY fa.created_at ASC
            `, [note.id]);
            note.attachments = files;
        }
        
        res.json(rows);
    } catch (error) {
        console.error('User notes fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/notes', async (req, res) => {
    const { title, content, priority = 'medium', category = 'general', snow_ticket, shift_date } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required' });
    }
    
    try {
        const [result] = await pool.execute(
            `INSERT INTO notes (title, content, priority, category, created_by, snow_ticket, shift_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, content, priority, category, req.user.id, snow_ticket || null, shift_date || new Date().toISOString().split('T')[0]]
        );
        
        // Fetch the created note with user details
        const [notes] = await pool.execute(`
            SELECT n.*, 
                   u1.name as created_by_name
            FROM notes n 
            LEFT JOIN users u1 ON n.created_by = u1.id 
            WHERE n.id = ?
        `, [result.insertId]);
        
        const note = notes[0];
        note.attachments = []; // New note has no attachments yet
        
        res.status(201).json(note);
    } catch (error) {
        console.error('Note creation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// File upload endpoint
app.post('/api/notes/:noteId/files', upload.array('files', 10), async (req, res) => {
    const { noteId } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
    }
    
    try {
        // Check if note exists and user can edit it
        const [notes] = await pool.execute('SELECT created_by FROM notes WHERE id = ?', [noteId]);
        if (notes.length === 0) {
            return res.status(404).json({ message: 'Note not found' });
        }
        
        if (notes[0].created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only attach files to your own notes' });
        }
        
        // Get user's Google tokens
        const [users] = await pool.execute('SELECT google_refresh_token FROM users WHERE id = ?', [req.user.id]);
        if (!users[0].google_refresh_token) {
            return res.status(400).json({ message: 'Google Drive not connected. Please sign in with Google.' });
        }
        
        const driveManager = new DriveManager(null, users[0].google_refresh_token);
        const uploadedFiles = [];
        
        for (const file of files) {
            try {
                // Upload to Google Drive
                const driveFile = await driveManager.uploadFile(
                    file.buffer,
                    file.originalname,
                    file.mimetype
                );
                
                // Save file reference to database
                const [result] = await pool.execute(
                    'INSERT INTO file_attachments (note_id, google_drive_id, filename, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
                    [noteId, driveFile.id, driveFile.name, driveFile.mimeType, driveFile.size, req.user.id]
                );
                
                uploadedFiles.push({
                    id: result.insertId,
                    note_id: noteId,
                    google_drive_id: driveFile.id,
                    filename: driveFile.name,
                    mime_type: driveFile.mimeType,
                    size_bytes: driveFile.size,
                    uploaded_by: req.user.id,
                    uploaded_by_name: req.user.name
                });
            } catch (error) {
                console.error('File upload error:', error);
                // Continue with other files even if one fails
            }
        }
        
        res.json({ 
            message: `${uploadedFiles.length} file(s) uploaded successfully`,
            files: uploadedFiles 
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ message: 'File upload failed' });
    }
});

// File download endpoint
app.get('/api/files/:fileId/download', async (req, res) => {
    const { fileId } = req.params;
    
    try {
        // Get file info from database
        const [files] = await pool.execute(
            'SELECT fa.*, n.created_by FROM file_attachments fa JOIN notes n ON fa.note_id = n.id WHERE fa.id = ?',
            [fileId]
        );
        
        if (files.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }
        
        const file = files[0];
        
        // Check permissions
        if (file.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Get uploader's Google tokens
        const [users] = await pool.execute('SELECT google_refresh_token FROM users WHERE id = ?', [file.uploaded_by]);
        if (!users[0].google_refresh_token) {
            return res.status(400).json({ message: 'File not accessible - uploader needs to reconnect Google Drive' });
        }
        
        const driveManager = new DriveManager(null, users[0].google_refresh_token);
        const fileStream = await driveManager.downloadFile(file.google_drive_id);
        
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Content-Type', file.mime_type);
        
        fileStream.pipe(res);
    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ message: 'File download failed' });
    }
});

// Delete file endpoint
app.delete('/api/files/:fileId', async (req, res) => {
    const { fileId } = req.params;
    
    try {
        // Get file info
        const [files] = await pool.execute(
            'SELECT fa.*, n.created_by FROM file_attachments fa JOIN notes n ON fa.note_id = n.id WHERE fa.id = ?',
            [fileId]
        );
        
        if (files.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }
        
        const file = files[0];
        
        // Check permissions
        if (file.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only delete files from your own notes' });
        }
        
        // Get uploader's Google tokens
        const [users] = await pool.execute('SELECT google_refresh_token FROM users WHERE id = ?', [file.uploaded_by]);
        if (users[0].google_refresh_token) {
            try {
                const driveManager = new DriveManager(null, users[0].google_refresh_token);
                await driveManager.deleteFile(file.google_drive_id);
            } catch (error) {
                console.error('Drive deletion error:', error);
                // Continue with database deletion even if Drive deletion fails
            }
        }
        
        // Delete from database
        await pool.execute('DELETE FROM file_attachments WHERE id = ?', [fileId]);
        
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('File deletion error:', error);
        res.status(500).json({ message: 'File deletion failed' });
    }
});

app.put('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, priority, category, status, snow_ticket } = req.body;
    
    try {
        // Check if user owns the note or is admin
        const [existingNote] = await pool.execute('SELECT created_by FROM notes WHERE id = ?', [id]);
        if (existingNote.length === 0) {
            return res.status(404).json({ message: 'Note not found' });
        }
        
        if (existingNote[0].created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only edit your own notes' });
        }
        
        await pool.execute(
            `UPDATE notes 
             SET title = ?, content = ?, priority = ?, category = ?, status = ?, snow_ticket = ?
             WHERE id = ?`,
            [title, content, priority, category, status, snow_ticket || null, id]
        );
        
        // Fetch updated note with attachments
        const [notes] = await pool.execute(`
            SELECT n.*, 
                   u1.name as created_by_name
            FROM notes n 
            LEFT JOIN users u1 ON n.created_by = u1.id 
            WHERE n.id = ?
        `, [id]);
        
        // Get file attachments
        const [files] = await pool.execute(`
            SELECT fa.*, u.name as uploaded_by_name 
            FROM file_attachments fa
            LEFT JOIN users u ON fa.uploaded_by = u.id
            WHERE fa.note_id = ?
            ORDER BY fa.created_at ASC
        `, [id]);
        
        const note = notes[0];
        note.attachments = files;
        
        res.json(note);
    } catch (error) {
        console.error('Note update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if user owns the note or is admin
        const [existingNote] = await pool.execute('SELECT created_by FROM notes WHERE id = ?', [id]);
        if (existingNote.length === 0) {
            return res.status(404).json({ message: 'Note not found' });
        }
        
        if (existingNote[0].created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only delete your own notes' });
        }
        
        // Delete associated files from Google Drive
        const [files] = await pool.execute('SELECT * FROM file_attachments WHERE note_id = ?', [id]);
        for (const file of files) {
            try {
                const [users] = await pool.execute('SELECT google_refresh_token FROM users WHERE id = ?', [file.uploaded_by]);
                if (users[0].google_refresh_token) {
                    const driveManager = new DriveManager(null, users[0].google_refresh_token);
                    await driveManager.deleteFile(file.google_drive_id);
                }
            } catch (error) {
                console.error('Drive file deletion error:', error);
                // Continue even if Drive deletion fails
            }
        }
        
        await pool.execute('DELETE FROM notes WHERE id = ?', [id]);
        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Note deletion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('POST /api/login - Traditional login');
    console.log('GET /auth/google - Google OAuth login');
    console.log('GET /api/users - List all users');
    console.log('GET /api/users/:id - Get single user');
    console.log('PUT /api/users/:id - Update user profile');
    console.log('DELETE /api/users/:id - Delete user (admin only)');
    console.log('POST /api/users - Create new user (admin only)');
    console.log('GET /api/notes - List all notes with attachments');
    console.log('GET /api/notes/user/:userId - Get notes by user and month');
    console.log('POST /api/notes - Create new note');
    console.log('PUT /api/notes/:id - Update note');
    console.log('DELETE /api/notes/:id - Delete note');
    console.log('POST /api/notes/:noteId/files - Upload files to note');
    console.log('GET /api/files/:fileId/download - Download file');
    console.log('DELETE /api/files/:fileId - Delete file');
});
