# IT-Shift-Notes

# IT Shift Notes - Complete Setup Guide

## Prerequisites
- Raspberry Pi 5 with Ubuntu/Debian
- MariaDB installed and running
- Nginx installed and configured
- Node.js installed

## Step 1: Database Setup

1. **Connect to MariaDB as root:**
   ```bash
   sudo mysql -u root -p
   ```

2. **Run the database schema script** (from the Database Schema Setup artifact above)

3. **Verify the setup:**
   ```sql
   USE it_shift_notes;
   SHOW TABLES;
   SELECT * FROM users;
   ```

## Step 2: Backend Setup

1. **Navigate to your project directory:**
   ```bash
   cd /home/<insert username>/it-shift-notes
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Replace your current server.js** with the enhanced version from the artifacts above

4. **Test the backend:**
   ```bash
   node server.js
   ```
   You should see: "Backend API running on http://localhost:3000"

## Step 3: Frontend Setup

1. **Create the public directory if it doesn't exist:**
   ```bash
   mkdir -p /home/<insert username>/it-shift-notes/public
   ```

2. **Replace your app.js** with the complete version from the artifacts above

3. **Ensure your HTML file is in the public directory:**
   ```bash
   cp /home/<insert username>/it-shift-notes/index.html /home/<insert username>/it-shift-notes/public/
   cp /home/<insert username>/it-shift-notes/style.css /home/<insert username>/it-shift-notes/public/
   cp /home/<insert username>/it-shift-notes/app.js /home/<insert username>/it-shift-notes/public/
   ```

## Step 4: Nginx Configuration

1. **Update your nginx configuration file** (usually in `/etc/nginx/sites-available/`):
   ```bash
   sudo nano /etc/nginx/sites-available/it-shift-notes
   ```

2. **Ensure the configuration matches your provided config** (it looks correct)

3. **Enable the site and restart nginx:**
   ```bash
   sudo ln -sf /etc/nginx/sites-available/it-shift-notes /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Step 5: Running the Application

1. **Start the backend server:**
   ```bash
   cd /home/<insert username>/it-shift-notes
   node server.js
   ```

2. **In a separate terminal, verify nginx is serving the frontend:**
   ```bash
   sudo systemctl status nginx
   ```

3. **Access the application:**
   - Open a web browser
   - Navigate to: `http://IP-ADDRESS`
   - You should see the login page

## Step 6: Test Login

Use these demo accounts (password: `password123`):
- **Admin:** admin@company.com
- **Technician:** john@company.com  
- **Manager:** sarah@company.com

## Step 7: Create a Systemd Service (Optional)

To auto-start the backend on boot:

1. **Create service file:**
   ```bash
   sudo nano /etc/systemd/system/it-shift-notes.service
   ```

2. **Add this content:**
   ```ini
   [Unit]
   Description=IT Shift Notes Backend
   After=network.target

   [Service]
   Type=simple
   User=zh
   WorkingDirectory=/home/zh/it-shift-notes
   ExecStart=/usr/bin/node server.js
   Restart=on-failure
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start the service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable it-shift-notes
   sudo systemctl start it-shift-notes
   ```

## Troubleshooting

### Backend Issues:
- **Check if Node.js is installed:** `node --version`
- **Check if dependencies are installed:** `npm list`
- **Check database connection:** Verify MariaDB is running with `sudo systemctl status mariadb`
- **Check logs:** `journalctl -u it-shift-notes -f`

### Frontend Issues:
- **Check nginx status:** `sudo systemctl status nginx`
- **Check nginx logs:** `sudo tail -f /var/log/nginx/error.log`
- **Verify file permissions:** `ls -la /home/zh/it-shift-notes/public/`

### Database Issues:
- **Test database connection:**
  ```bash
  mysql -u shiftnotes_user -p -h 127.0.0.1 it_shift_notes
  ```
- **Check if tables exist:** `SHOW TABLES;`

### Network Issues:
- **Check if port 3000 is open:** `netstat -tlnp | grep 3000`
- **Check nginx proxy:** `curl http://localhost/api/users` (should return 401 Unauthorized)

## File Structure
```
/home/<insert username>/it-shift-notes/
├── package.json
├── server.js          (Enhanced backend)
└── public/
    ├── index.html      (Your existing HTML)
    ├── style.css       (Your existing CSS)
    └── app.js          (Enhanced frontend)
```

## Features Available After Setup

1. **Dashboard:** Overview with statistics and recent notes
2. **Notes Management:** Create, edit, delete, and view all notes
3. **Team Members:** View all users and their activity
4. **Settings:** User profile and system information
5. **Authentication:** Secure login with JWT tokens
6. **Responsive Design:** Works on desktop and mobile

## Default Demo Data
The database setup includes sample users and notes so you can immediately test all features.
