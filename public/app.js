// public/app.js - Enhanced IT Shift Notes Application with Google Drive Integration
document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // --- STATE ---
        state: {
            token: null, 
            currentUser: null, 
            users: [], 
            notes: [], 
            activeView: 'dashboard',
            editingNote: null,
            showNoteForm: false,
            viewingUser: null,
            selectedMonth: new Date().getMonth() + 1,
            selectedYear: new Date().getFullYear(),
            uploadingFiles: false
        },

        // --- API ---
        api: {
            BASE_URL: '/api',
            
            async login(email, password) {
                const res = await fetch(`${this.BASE_URL}/login`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                return data;
            },
            
            async fetchData(token) {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [usersRes, notesRes] = await Promise.all([
                    fetch(`${this.BASE_URL}/users`, { headers }),
                    fetch(`${this.BASE_URL}/notes`, { headers })
                ]);
                if (!usersRes.ok || !notesRes.ok) throw new Error('Session expired.');
                App.state.users = await usersRes.json();
                App.state.notes = await notesRes.json();
            },
            
            async fetchUserNotes(userId, year, month) {
                const headers = { 'Authorization': `Bearer ${App.state.token}` };
                const res = await fetch(`${this.BASE_URL}/notes/user/${userId}?year=${year}&month=${month}`, { headers });
                if (!res.ok) throw new Error('Failed to fetch user notes');
                return await res.json();
            },
            
            async createNote(noteData) {
                const res = await fetch(`${this.BASE_URL}/notes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${App.state.token}`
                    },
                    body: JSON.stringify(noteData)
                });
                if (!res.ok) throw new Error('Failed to create note');
                return await res.json();
            },
            
            async updateNote(id, noteData) {
                const res = await fetch(`${this.BASE_URL}/notes/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${App.state.token}`
                    },
                    body: JSON.stringify(noteData)
                });
                if (!res.ok) throw new Error('Failed to update note');
                return await res.json();
            },
            
            async deleteNote(id) {
                const res = await fetch(`${this.BASE_URL}/notes/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${App.state.token}` }
                });
                if (!res.ok) throw new Error('Failed to delete note');
                return await res.json();
            },
            
            async uploadFiles(noteId, files) {
                const formData = new FormData();
                Array.from(files).forEach(file => formData.append('files', file));
                
                const res = await fetch(`${this.BASE_URL}/notes/${noteId}/files`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${App.state.token}` },
                    body: formData
                });
                if (!res.ok) throw new Error('Failed to upload files');
                return await res.json();
            },
            
            async deleteFile(fileId) {
                const res = await fetch(`${this.BASE_URL}/files/${fileId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${App.state.token}` }
                });
                if (!res.ok) throw new Error('Failed to delete file');
                return await res.json();
            },
            
            getFileDownloadUrl(fileId) {
                return `${this.BASE_URL}/files/${fileId}/download?token=${App.state.token}`;
            },
            
            async createUser(userData) {
                const res = await fetch(`${this.BASE_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${App.state.token}`
                    },
                    body: JSON.stringify(userData)
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message);
                }
                return await res.json();
            },
            
            async updateUser(id, userData) {
                const res = await fetch(`${this.BASE_URL}/users/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${App.state.token}`
                    },
                    body: JSON.stringify(userData)
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message);
                }
                return await res.json();
            },
            
            async deleteUser(id) {
                const res = await fetch(`${this.BASE_URL}/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${App.state.token}` }
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message);
                }
                return await res.json();
            }
        },

        // --- UTILITIES ---
        utils: {
            getPriorityColor(priority) {
                switch (priority) {
                    case 'critical': return 'text-red-600';
                    case 'high': return 'text-orange-600';
                    case 'medium': return 'text-yellow-600';
                    case 'low': return 'text-green-600';
                    default: return 'text-gray-600';
                }
            },
            
            getPriorityBadgeClass(priority) {
                switch (priority) {
                    case 'critical': return 'bg-red-100 text-red-800';
                    case 'high': return 'bg-orange-100 text-orange-800';
                    case 'medium': return 'bg-yellow-100 text-yellow-800';
                    case 'low': return 'bg-green-100 text-green-800';
                    default: return 'bg-gray-100 text-gray-800';
                }
            },
            
            getStatusBadgeClass(status) {
                switch (status) {
                    case 'active': return 'bg-blue-100 text-blue-800';
                    case 'resolved': return 'bg-green-100 text-green-800';
                    case 'archived': return 'bg-gray-100 text-gray-800';
                    default: return 'bg-gray-100 text-gray-800';
                }
            },
            
            getMonthName(month) {
                const months = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
                return months[month - 1];
            },
            
            canEditNote(note) {
                return App.state.currentUser.role === 'admin' || note.created_by === App.state.currentUser.id;
            },
            
            canDeleteNote(note) {
                return App.state.currentUser.role === 'admin' || note.created_by === App.state.currentUser.id;
            },
            
            formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },
            
            getFileIcon(mimeType) {
                if (mimeType.startsWith('image/')) return '🖼️';
                if (mimeType.startsWith('video/')) return '🎥';
                if (mimeType.startsWith('audio/')) return '🎵';
                if (mimeType.includes('pdf')) return '📄';
                if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
                if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
                if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📈';
                if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
                return '📎';
            }
        },

        // --- RENDER ---
        render: {
            app() {
                const root = document.getElementById('app-root');
                root.innerHTML = App.state.currentUser ? App.render.shell() : App.render.login();
            },
            
            shell() {
                const user = App.state.currentUser;
                const views = [
                    { id: 'dashboard', name: 'Dashboard', icon: '📋' },
                    { id: 'notes', name: 'All Notes', icon: '📝' },
                    { id: 'team', name: 'Team Members', icon: '👥' },
                    { id: 'settings', name: 'Settings', icon: '⚙️' }
                ];
                
                return `
                    <div class="min-h-screen bg-gray-50 flex">
                        <div class="w-64 bg-white shadow-xl h-screen flex flex-col border-r border-gray-200">
                            <div class="p-6 border-b border-gray-100">
                                <div class="flex items-center space-x-3">
                                    <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                        <span class="text-white font-bold text-sm">IT</span>
                                    </div>
                                    <h1 class="text-xl font-bold text-gray-800">Shift Notes</h1>
                                </div>
                            </div>
                            <nav class="flex-1 px-4 py-6 space-y-2">
                                ${views.map(v => `
                                    <button data-action="set-view" data-view="${v.id}" 
                                            class="w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${App.state.activeView === v.id ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
                                        <span class="mr-3 text-lg">${v.icon}</span>${v.name}
                                    </button>
                                `).join('')}
                            </nav>
                            <div class="p-4 border-t border-gray-100">
                                <div class="flex items-center space-x-3 mb-4 p-3 bg-gray-50 rounded-xl">
                                    <div class="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-semibold">
                                        ${user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p class="font-semibold text-sm text-gray-900">${user.name}</p>
                                        <p class="text-xs text-gray-500 capitalize">${user.role}</p>
                                    </div>
                                </div>
                                <button data-action="logout" class="w-full text-center px-4 py-3 text-sm bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors font-medium">
                                    Sign Out
                                </button>
                            </div>
                        </div>
                        <main id="content-display" class="flex-1 overflow-y-auto"></main>
                    </div>`;
            },
            
            view(viewName) {
                const content = document.getElementById('content-display');
                if (!content) return;
                let html = '';
                switch (viewName) {
                    case 'dashboard': html = App.render.dashboard(); break;
                    case 'notes': html = App.render.allNotes(); break;
                    case 'team': html = App.render.team(); break;
                    case 'user-notes': html = App.render.userNotes(); break;
                    case 'settings': html = App.render.settings(); break;
                    default: html = `<div class="p-6"><h1 class="text-2xl font-bold">Page Not Found</h1></div>`;
                }
                content.innerHTML = html;
                
                // Initialize rich text editor if note form is present
                if (document.getElementById('note-content')) {
                    App.initRichTextEditor();
                }
                
                // Initialize file upload if file input is present
                if (document.getElementById('file-input')) {
                    App.handlers.setupFileUpload();
                }
            },
            
            login() {
                return `
                    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                        <div class="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200">
                            <div class="text-center mb-8">
                                <div class="w-16 h-16 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                                    <span class="text-white text-2xl font-bold">IT</span>
                                </div>
                                <h2 class="text-2xl font-bold text-gray-900 mb-2">IT Shift Notes</h2>
                                <p class="text-gray-600 text-sm">Sign in to your account</p>
                            </div>
                            
                            <div id="login-error" class="text-red-500 text-center mb-4 p-3 bg-red-50 rounded-xl hidden"></div>
                            
                            <!-- Google Sign-In Button -->
                            <div class="mb-6">
                                <a href="/auth/google" class="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                                    <svg class="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Sign in with Google
                                </a>
                            </div>
                            
                            <div class="relative mb-6">
                                <div class="absolute inset-0 flex items-center">
                                    <div class="w-full border-t border-gray-300"></div>
                                </div>
                                <div class="relative flex justify-center text-sm">
                                    <span class="px-2 bg-white text-gray-500">Or continue with email</span>
                                </div>
                            </div>
                            
                            <form id="login-form" class="space-y-6">
                                <div>
                                    <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input type="email" id="email" required 
                                           class="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                           placeholder="Enter your email">
                                </div>
                                <div>
                                    <label for="password" class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                    <input type="password" id="password" required 
                                           class="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                           placeholder="Enter your password">
                                </div>
                                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-medium transition-all hover:shadow-md transform hover:scale-105">
                                    Sign In
                                </button>
                            </form>
                            
                            <div class="mt-8 p-4 bg-gray-50 rounded-xl">
                                <h3 class="text-sm font-medium text-gray-700 mb-3 text-center">Demo Accounts</h3>
                                <div class="space-y-2 text-xs text-gray-600">
                                    <div class="flex justify-between items-center p-2 bg-white rounded-lg">
                                        <span class="font-medium">Administrator:</span>
                                        <span class="text-blue-600">admin@company.com</span>
                                    </div>
                                    <div class="flex justify-between items-center p-2 bg-white rounded-lg">
                                        <span class="font-medium">Technician:</span>
                                        <span class="text-blue-600">john@company.com</span>
                                    </div>
                                    <div class="flex justify-between items-center p-2 bg-white rounded-lg">
                                        <span class="font-medium">Technician:</span>
                                        <span class="text-blue-600">sarah@company.com</span>
                                    </div>
                                    <div class="text-center pt-2 text-gray-500">
                                        Password for all accounts: <span class="font-medium">password123</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            },
            
            dashboard() {
                const recentNotes = App.state.notes.slice(0, 5);
                const todaysNotes = App.state.notes.filter(note => {
                    const noteDate = new Date(note.shift_date).toDateString();
                    const today = new Date().toDateString();
                    return noteDate === today;
                });
                
                const priorityStats = {
                    critical: App.state.notes.filter(n => n.priority === 'critical' && n.status === 'active').length,
                    high: App.state.notes.filter(n => n.priority === 'high' && n.status === 'active').length,
                    medium: App.state.notes.filter(n => n.priority === 'medium' && n.status === 'active').length,
                    low: App.state.notes.filter(n => n.priority === 'low' && n.status === 'active').length
                };
                
                return `
                    <div class="p-6 bg-gray-50 min-h-screen">
                        <div class="max-w-6xl mx-auto">
                            <div class="flex justify-between items-center mb-8">
                                <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
                                <button data-action="new-note" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow-sm transition-all hover:shadow-md">
                                    + New Daily Note
                                </button>
                            </div>
                            
                            <!-- Stats Cards -->
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h3 class="text-sm font-medium text-gray-500 mb-2">Today's Notes</h3>
                                    <p class="text-3xl font-bold text-gray-900">${todaysNotes.length}</p>
                                </div>
                                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h3 class="text-sm font-medium text-gray-500 mb-2">Critical Issues</h3>
                                    <p class="text-3xl font-bold text-red-600">${priorityStats.critical}</p>
                                </div>
                                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h3 class="text-sm font-medium text-gray-500 mb-2">High Priority</h3>
                                    <p class="text-3xl font-bold text-orange-600">${priorityStats.high}</p>
                                </div>
                                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h3 class="text-sm font-medium text-gray-500 mb-2">Total Active</h3>
                                    <p class="text-3xl font-bold text-blue-600">${App.state.notes.filter(n => n.status === 'active').length}</p>
                                </div>
                            </div>
                            
                            <!-- Recent Notes -->
                            <div class="bg-white rounded-xl shadow-sm border border-gray-200">
                                <div class="p-6 border-b border-gray-100">
                                    <h2 class="text-xl font-semibold text-gray-900">Recent Notes</h2>
                                </div>
                                <div class="divide-y divide-gray-100">
                                    ${recentNotes.length ? recentNotes.map(note => `
                                        <div class="p-6 hover:bg-gray-50 transition-colors">
                                            <div class="flex justify-between items-start">
                                                <div class="flex-1">
                                                    <div class="flex items-center space-x-3 mb-3">
                                                        <h3 class="font-semibold text-gray-900">${note.title}</h3>
                                                        <span class="px-2 py-1 text-xs font-medium rounded-full ${App.utils.getPriorityBadgeClass(note.priority)}">
                                                            ${note.priority.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div class="text-sm text-gray-600 mb-3 note-content line-clamp-3">${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}</div>
                                                    <div class="flex items-center space-x-4 text-xs text-gray-500">
                                                        <div class="flex items-center space-x-2">
                                                            <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                                ${note.created_by_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span class="font-medium">${note.created_by_name}</span>
                                                        </div>
                                                        <span class="capitalize ${App.utils.getPriorityColor(note.priority)}">${note.priority}</span>
                                                        <span>${new Date(note.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('') : '<div class="p-12 text-center text-gray-500">No notes yet. Create your first note!</div>'}
                                </div>
                            </div>
                        </div>
                    </div>`;
            },
            
            allNotes() {
                return `
                    <div class="p-6 bg-gray-50 min-h-screen">
                        <div class="max-w-5xl mx-auto">
                            <div class="flex justify-between items-center mb-8">
                                <h1 class="text-3xl font-bold text-gray-900">All Notes</h1>
                                <button data-action="new-note" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow-sm transition-all hover:shadow-md">
                                    + New Daily Note
                                </button>
                            </div>
                            
                            ${App.state.showNoteForm ? App.render.noteForm() : ''}
                            
                            <div class="space-y-4">
                                ${App.state.notes.length ? App.state.notes.map(note => `
                                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden group">
                                        <div class="p-6">
                                            <!-- Header with title and badges -->
                                            <div class="flex items-start justify-between mb-4">
                                                <div class="flex items-center space-x-3 flex-1">
                                                    <h3 class="text-xl font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">${note.title}</h3>
                                                    <div class="flex space-x-2">
                                                        <span class="px-3 py-1 text-xs font-medium rounded-full ${App.utils.getPriorityBadgeClass(note.priority)}">
                                                            ${note.priority.toUpperCase()}
                                                        </span>
                                                        <span class="px-3 py-1 text-xs font-medium rounded-full ${App.utils.getStatusBadgeClass(note.status)}">
                                                            ${note.status.toUpperCase()}
                                                        </span>
                                                        ${note.attachments && note.attachments.length > 0 ? `
                                                            <span class="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                                                📎 ${note.attachments.length} file${note.attachments.length > 1 ? 's' : ''}
                                                            </span>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                                <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    ${App.utils.canEditNote(note) ? `
                                                        <button data-action="edit-note" data-note-id="${note.id}" 
                                                                class="text-gray-500 hover:text-blue-600 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                                                            Edit
                                                        </button>
                                                    ` : ''}
                                                    ${App.utils.canDeleteNote(note) ? `
                                                        <button data-action="delete-note" data-note-id="${note.id}" 
                                                                class="text-gray-500 hover:text-red-600 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                                                            Delete
                                                        </button>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            
                                            <!-- Note content -->
                                            <div class="text-gray-700 mb-4 note-content leading-relaxed max-h-64 overflow-y-auto">
                                                ${note.content}
                                            </div>
                                            
                                            <!-- File Attachments -->
                                            ${note.attachments && note.attachments.length > 0 ? `
                                                <div class="mb-4">
                                                    <h4 class="text-sm font-medium text-gray-700 mb-3">Attachments:</h4>
                                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        ${note.attachments.map(file => `
                                                            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                                <span class="text-xl">${App.utils.getFileIcon(file.mime_type)}</span>
                                                                <div class="flex-1 min-w-0">
                                                                    <p class="font-medium text-sm text-gray-900 truncate">${file.filename}</p>
                                                                    <p class="text-xs text-gray-500">${App.utils.formatFileSize(file.size_bytes)}</p>
                                                                </div>
                                                                <a href="${App.api.getFileDownloadUrl(file.id)}" target="_blank"
                                                                   class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                                    Download
                                                                </a>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            ` : ''}
                                            
                                            <!-- Footer with metadata -->
                                            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                                                <div class="flex items-center space-x-6 text-sm text-gray-500">
                                                    <div class="flex items-center space-x-2">
                                                        <div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                            ${note.created_by_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span class="font-medium text-gray-700">${note.created_by_name}</span>
                                                    </div>
                                                    ${note.snow_ticket ? `
                                                        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                                                            SNOW: ${note.snow_ticket}
                                                        </span>
                                                    ` : ''}
                                                    <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium capitalize">
                                                        ${note.category}
                                                    </span>
                                                </div>
                                                <div class="text-sm text-gray-500 font-medium">
                                                    ${new Date(note.shift_date).toLocaleDateString('en-US', { 
                                                        weekday: 'short', 
                                                        year: 'numeric', 
                                                        month: 'short', 
                                                        day: 'numeric' 
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                                        <div class="text-gray-400 text-6xl mb-4">📝</div>
                                        <h3 class="text-xl font-semibold text-gray-600 mb-2">No notes yet</h3>
                                        <p class="text-gray-500 mb-6">Create your first daily note to get started</p>
                                        <button data-action="new-note" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium">
                                            Create First Note
                                        </button>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>`;
            },
            
            noteForm() {
                const isEdit = App.state.editingNote;
                const note = isEdit ? App.state.editingNote : {};
                
                return `
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
                        <div class="p-6 border-b border-gray-100">
                            <h2 class="text-xl font-semibold text-gray-900">${isEdit ? 'Edit Daily Note' : 'Create New Daily Note'}</h2>
                            <p class="text-sm text-gray-600 mt-1">Create a comprehensive daily note with multiple incidents, issues, and tasks.</p>
                        </div>
                        <form id="note-form" class="p-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Title / Summary</label>
                                    <input type="text" name="title" value="${note.title || ''}" required 
                                           placeholder="e.g., Daily IT Report - March 15, 2025"
                                           class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Overall Priority</label>
                                    <select name="priority" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                        <option value="low" ${note.priority === 'low' ? 'selected' : ''}>Low</option>
                                        <option value="medium" ${note.priority === 'medium' || !note.priority ? 'selected' : ''}>Medium</option>
                                        <option value="high" ${note.priority === 'high' ? 'selected' : ''}>High</option>
                                        <option value="critical" ${note.priority === 'critical' ? 'selected' : ''}>Critical</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                    <select name="category" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                        <option value="general" ${note.category === 'general' || !note.category ? 'selected' : ''}>General</option>
                                        <option value="infrastructure" ${note.category === 'infrastructure' ? 'selected' : ''}>Infrastructure</option>
                                        <option value="network" ${note.category === 'network' ? 'selected' : ''}>Network</option>
                                        <option value="security" ${note.category === 'security' ? 'selected' : ''}>Security</option>
                                        <option value="backup" ${note.category === 'backup' ? 'selected' : ''}>Backup</option>
                                        <option value="maintenance" ${note.category === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                                    </select>
                                </div>
                                ${isEdit ? `
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                        <select name="status" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                            <option value="active" ${note.status === 'active' ? 'selected' : ''}>Active</option>
                                            <option value="resolved" ${note.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                            <option value="archived" ${note.status === 'archived' ? 'selected' : ''}>Archived</option>
                                        </select>
                                    </div>
                                ` : ''}
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">SNOW Ticket #</label>
                                    <input type="text" name="snow_ticket" value="${note.snow_ticket || ''}" 
                                           placeholder="e.g., INC0012345"
                                           class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                            </div>
                            
                            <div class="mb-6">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Daily Report Content</label>
                                <div class="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                                    <div id="editor-toolbar" class="border-b bg-gray-50 p-3 flex flex-wrap gap-2 text-sm">
                                        <button type="button" data-command="bold" class="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors">
                                            <strong>B</strong>
                                        </button>
                                        <button type="button" data-command="italic" class="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors">
                                            <em>I</em>
                                        </button>
                                        <button type="button" data-command="underline" class="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors">
                                            <u>U</u>
                                        </button>
                                        <div class="w-px bg-gray-300 mx-1"></div>
                                        <button type="button" data-command="insertOrderedList" class="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors">
                                            1. List
                                        </button>
                                        <button type="button" data-command="insertUnorderedList" class="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors">
                                            • List
                                        </button>
                                        <div class="w-px bg-gray-300 mx-1"></div>
                                        <button type="button" data-command="createLink" class="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors">
                                            🔗 Link
                                        </button>
                                        <select data-command="foreColor" class="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white">
                                            <option value="black">Black</option>
                                            <option value="red">Red</option>
                                            <option value="blue">Blue</option>
                                            <option value="green">Green</option>
                                            <option value="orange">Orange</option>
                                        </select>
                                    </div>
                                    <div id="note-content" contenteditable="true" 
                                         class="p-4 min-h-64 max-h-96 overflow-y-auto focus:outline-none bg-white">${note.content || ''}</div>
                                </div>
                                <textarea name="content" id="hidden-content" class="hidden" required></textarea>
                            </div>
                            
                            ${isEdit && note.attachments && note.attachments.length > 0 ? `
                                <!-- Existing Attachments -->
                                <div class="mb-6">
                                    <label class="block text-sm font-medium text-gray-700 mb-3">Existing Attachments</label>
                                    <div class="space-y-2">
                                        ${note.attachments.map(file => `
                                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div class="flex items-center space-x-3">
                                                    <span class="text-2xl">${App.utils.getFileIcon(file.mime_type)}</span>
                                                    <div>
                                                        <p class="font-medium text-sm text-gray-900">${file.filename}</p>
                                                        <p class="text-xs text-gray-500">${App.utils.formatFileSize(file.size_bytes)} • Uploaded by ${file.uploaded_by_name}</p>
                                                    </div>
                                                </div>
                                                <div class="flex space-x-2">
                                                    <a href="${App.api.getFileDownloadUrl(file.id)}" target="_blank"
                                                       class="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                                                        Download
                                                    </a>
                                                    <button data-action="delete-file" data-file-id="${file.id}"
                                                            class="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <!-- File Upload Section -->
                            <div class="mb-6">
                                <label class="block text-sm font-medium text-gray-700 mb-3">
                                    Attach Files ${isEdit ? '(Add More)' : ''}
                                    <span class="text-gray-500 font-normal">(Max 10 files, 50MB each)</span>
                                </label>
                                <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
                                     id="file-drop-zone">
                                    <input type="file" id="file-input" multiple accept="*/*" class="hidden">
                                    <div class="text-gray-600">
                                        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                        <p class="text-sm">
                                            <button type="button" id="file-select-btn" class="font-medium text-blue-600 hover:text-blue-500">
                                                Click to upload files
                                            </button>
                                            or drag and drop
                                        </p>
                                        <p class="text-xs text-gray-500 mt-1">
                                            Supports all file types
                                        </p>
                                    </div>
                                </div>
                                
                                <!-- Selected Files Preview -->
                                <div id="selected-files" class="mt-4 space-y-2 hidden">
                                    <h4 class="text-sm font-medium text-gray-700">Selected Files:</h4>
                                    <div id="file-list" class="space-y-2"></div>
                                </div>
                            </div>
                            
                            <div class="flex justify-end space-x-4">
                                <button type="button" data-action="cancel-note" 
                                        class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" 
                                        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                    ${isEdit ? 'Update Note' : 'Create Daily Note'}
                                </button>
                            </div>
                        </form>
                    </div>`;
            },
            
            team() {
                return `
                    <div class="p-6 bg-gray-50 min-h-screen">
                        <div class="max-w-5xl mx-auto">
                            <h1 class="text-3xl font-bold text-gray-900 mb-8">Team Members</h1>
                            
                            <div class="space-y-4">
                                ${App.state.users.map(user => {
                                    const userNotes = App.state.notes.filter(note => note.created_by === user.id);
                                    
                                    return `
                                        <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden group">
                                            <div class="p-6">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center space-x-4">
                                                        <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                            ${user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div class="flex-1">
                                                            <h3 class="text-lg font-semibold text-gray-900">${user.name}</h3>
                                                            <p class="text-gray-600">${user.email}</p>
                                                            <span class="inline-block px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize mt-2">
                                                                ${user.role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center space-x-6">
                                                        <div class="text-right text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                                                            <p class="font-medium text-gray-700 mb-1">Statistics</p>
                                                            <p>Total Notes: <span class="font-semibold text-gray-900">${userNotes.length}</span></p>
                                                            <p>This Month: <span class="font-semibold text-gray-900">${userNotes.filter(n => {
                                                                const noteMonth = new Date(n.shift_date).getMonth() + 1;
                                                                const noteYear = new Date(n.shift_date).getFullYear();
                                                                return noteMonth === new Date().getMonth() + 1 && noteYear === new Date().getFullYear();
                                                            }).length}</span></p>
                                                        </div>
                                                        <button data-action="view-user-notes" data-user-id="${user.id}" data-user-name="${user.name}"
                                                                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all hover:shadow-md transform hover:scale-105">
                                                            View Notes
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>`;
            },
            
            userNotes() {
                const user = App.state.viewingUser;
                if (!user) return '<div class="p-6">User not found</div>';
                
                const months = Array.from({length: 12}, (_, i) => i + 1);
                const years = [2023, 2024, 2025, 2026];
                
                return `
                    <div class="p-6 bg-gray-50 min-h-screen">
                        <div class="max-w-5xl mx-auto">
                            <div class="flex items-center justify-between mb-8">
                                <div class="flex items-center space-x-4">
                                    <button data-action="back-to-team" class="text-blue-600 hover:text-blue-800 font-medium">
                                        ← Back to Team
                                    </button>
                                    <div>
                                        <h1 class="text-3xl font-bold text-gray-900">${user.name}'s Notes</h1>
                                        <p class="text-gray-600">${App.utils.getMonthName(App.state.selectedMonth)} ${App.state.selectedYear}</p>
                                    </div>
                                </div>
                                
                                <div class="flex space-x-4">
                                    <select id="month-select" class="border border-gray-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500">
                                        ${months.map(month => `
                                            <option value="${month}" ${month === App.state.selectedMonth ? 'selected' : ''}>
                                                ${App.utils.getMonthName(month)}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <select id="year-select" class="border border-gray-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500">
                                        ${years.map(year => `
                                            <option value="${year}" ${year === App.state.selectedYear ? 'selected' : ''}>
                                                ${year}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <button data-action="load-user-notes" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                                        Load Notes
                                    </button>
                                </div>
                            </div>
                            
                            <div id="user-notes-container" class="bg-white rounded-xl shadow-sm border border-gray-200">
                                <div class="p-12 text-center text-gray-500">
                                    <div class="text-gray-400 text-6xl mb-4">📅</div>
                                    <h3 class="text-xl font-semibold text-gray-600 mb-2">Select a month and year</h3>
                                    <p class="text-gray-500">Choose a time period to view notes</p>
                                </div>
                            </div>
                        </div>
                    </div>`;
            },
            
            settings() {
                const user = App.state.currentUser;
                const isAdmin = user.role === 'admin';
                
                return `
                    <div class="p-6 bg-gray-50 min-h-screen">
                        <div class="max-w-6xl mx-auto">
                            <h1 class="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
                            
                            <div class="grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-8">
                                <!-- User Profile -->
                                <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                                    <div class="p-6 border-b border-gray-100">
                                        <h2 class="text-xl font-semibold text-gray-900">User Profile</h2>
                                        <p class="text-gray-600 text-sm mt-1">Manage your personal information</p>
                                    </div>
                                    <div class="p-6">
                                        <div class="flex items-center space-x-4 mb-6">
                                            <div class="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
                                                ${user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 class="font-semibold text-lg text-gray-900">${user.name}</h3>
                                                <p class="text-gray-600">${user.email}</p>
                                                <span class="inline-block px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 capitalize mt-1">
                                                    ${user.role}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <form id="profile-form" class="space-y-4">
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                                <input type="text" name="name" value="${user.name}" required
                                                       class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                                <input type="email" name="email" value="${user.email}" required
                                                       class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                            </div>
                                            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all hover:shadow-md">
                                                Update Profile
                                            </button>
                                        </form>
                                    </div>
                                </div>
                                
                                ${isAdmin ? `
                                    <!-- User Management (Admin Only) -->
                                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                                        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                                            <div>
                                                <h2 class="text-xl font-semibold text-gray-900">User Management</h2>
                                                <p class="text-gray-600 text-sm mt-1">Add, edit, and manage team members</p>
                                            </div>
                                            <button data-action="show-add-user" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all hover:shadow-md">
                                                + Add User
                                            </button>
                                        </div>
                                        <div class="max-h-96 overflow-y-auto">
                                            ${App.state.users.map(u => `
                                                <div class="p-4 border-b border-gray-100 last:border-b-0 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                                    <div class="flex items-center space-x-3">
                                                        <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                                                            ${u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h4 class="font-medium text-gray-900">${u.name}</h4>
                                                            <p class="text-sm text-gray-600">${u.email}</p>
                                                            <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 capitalize">${u.role}</span>
                                                        </div>
                                                    </div>
                                                    <div class="flex space-x-2">
                                                        <button data-action="edit-user" data-user-id="${u.id}" 
                                                                class="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">Edit</button>
                                                        ${u.id !== user.id ? `
                                                            <button data-action="delete-user" data-user-id="${u.id}" data-user-name="${u.name}"
                                                                    class="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : `
                                    <!-- System Information -->
                                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                                        <div class="p-6 border-b border-gray-100">
                                            <h2 class="text-xl font-semibold text-gray-900">System Information</h2>
                                            <p class="text-gray-600 text-sm mt-1">Overview of your account statistics</p>
                                        </div>
                                        <div class="p-6">
                                            <div class="grid grid-cols-2 gap-4">
                                                <div class="bg-gray-50 rounded-xl p-4 text-center">
                                                    <div class="text-2xl font-bold text-gray-900">${App.state.users.length}</div>
                                                    <div class="text-sm text-gray-600">Total Users</div>
                                                </div>
                                                <div class="bg-gray-50 rounded-xl p-4 text-center">
                                                    <div class="text-2xl font-bold text-gray-900">${App.state.notes.length}</div>
                                                    <div class="text-sm text-gray-600">Total Notes</div>
                                                </div>
                                                <div class="bg-blue-50 rounded-xl p-4 text-center">
                                                    <div class="text-2xl font-bold text-blue-600">${App.state.notes.filter(n => n.created_by === user.id).length}</div>
                                                    <div class="text-sm text-gray-600">Your Notes</div>
                                                </div>
                                                <div class="bg-green-50 rounded-xl p-4 text-center">
                                                    <div class="text-2xl font-bold text-green-600">${App.state.notes.filter(n => {
                                                        const noteMonth = new Date(n.shift_date).getMonth() + 1;
                                                        const noteYear = new Date(n.shift_date).getFullYear();
                                                        return n.created_by === user.id && noteMonth === new Date().getMonth() + 1 && noteYear === new Date().getFullYear();
                                                    }).length}</div>
                                                    <div class="text-sm text-gray-600">This Month</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `}
                            </div>
                            
                            <!-- Modals will be inserted here -->
                            <div id="modal-container"></div>
                        </div>
                    </div>`;
            },
            
            addUserModal() {
                return `
                    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                            <h3 class="text-xl font-semibold text-gray-900 mb-6">Add New User</h3>
                            <form id="add-user-form" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                    <input type="text" name="name" required
                                           class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                    <input type="email" name="email" required
                                           class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                    <input type="password" name="password" required
                                           class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                    <select name="role" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                        <option value="technician">Technician</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                                <div class="flex justify-end space-x-3 pt-6">
                                    <button type="button" data-action="close-modal" 
                                            class="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" 
                                            class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all hover:shadow-md">
                                        Add User
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>`;
            },
            
            editUserModal(user) {
                return `
                    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                            <h3 class="text-xl font-semibold text-gray-900 mb-6">Edit User</h3>
                            <form id="edit-user-form" class="space-y-4">
                                <input type="hidden" name="userId" value="${user.id}">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                    <input type="text" name="name" value="${user.name}" required
                                           class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                    <input type="email" name="email" value="${user.email}" required
                                           class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                    <select name="role" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                        <option value="technician" ${user.role === 'technician' ? 'selected' : ''}>Technician</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                                    </select>
                                </div>
                                <div class="flex justify-end space-x-3 pt-6">
                                    <button type="button" data-action="close-modal" 
                                            class="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" 
                                            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all hover:shadow-md">
                                        Update User
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>`;
            }
        },

        // Rich text editor initialization
        initRichTextEditor() {
            const editor = document.getElementById('note-content');
            const hiddenField = document.getElementById('hidden-content');
            
            if (!editor || !hiddenField) return;
            
            // Toolbar event handlers
            document.querySelectorAll('#editor-toolbar button[data-command]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const command = btn.dataset.command;
                    
                    // Focus editor first
                    editor.focus();
                    
                    if (command === 'createLink') {
                        const selection = window.getSelection();
                        if (selection.rangeCount > 0) {
                            const url = prompt('Enter URL:');
                            if (url) {
                                document.execCommand('createLink', false, url);
                            }
                        } else {
                            alert('Please select some text first to create a link.');
                        }
                    } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
                        // Special handling for lists to ensure they work properly
                        const selection = window.getSelection();
                        if (selection.rangeCount > 0) {
                            document.execCommand(command, false, null);
                            // Force a small delay and refocus to ensure the command takes effect
                            setTimeout(() => {
                                editor.focus();
                            }, 10);
                        }
                    } else {
                        document.execCommand(command, false, null);
                    }
                });
            });
            
            // Color selector
            const colorSelect = document.querySelector('#editor-toolbar select[data-command="foreColor"]');
            if (colorSelect) {
                colorSelect.addEventListener('change', (e) => {
                    editor.focus();
                    document.execCommand('foreColor', false, e.target.value);
                });
            }
            
            // Handle keyboard shortcuts
            editor.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key) {
                        case 'b':
                            e.preventDefault();
                            document.execCommand('bold', false, null);
                            break;
                        case 'i':
                            e.preventDefault();
                            document.execCommand('italic', false, null);
                            break;
                        case 'u':
                            e.preventDefault();
                            document.execCommand('underline', false, null);
                            break;
                    }
                }
            });
            
            // Update hidden field on content change
            const updateHiddenField = () => {
                hiddenField.value = editor.innerHTML;
            };
            
            editor.addEventListener('input', updateHiddenField);
            editor.addEventListener('blur', updateHiddenField);
            
            // Initialize content if editing
            if (editor.innerHTML.trim()) {
                updateHiddenField();
            }
        },

        // --- HANDLERS ---
        handlers: {
            async login(e) {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const errorEl = document.getElementById('login-error');
                
                try {
                    errorEl.classList.add('hidden');
                    const data = await App.api.login(email, password);
                    App.state.token = data.token;
                    App.state.currentUser = data.user;
                    await App.api.fetchData(App.state.token);
                    App.render.app();
                    App.render.view('dashboard');
                } catch (error) {
                    errorEl.textContent = error.message;
                    errorEl.classList.remove('hidden');
                }
            },
            
            logout() {
                App.state.token = null;
                App.state.currentUser = null;
                App.state.users = [];
                App.state.notes = [];
                App.state.activeView = 'dashboard';
                App.state.editingNote = null;
                App.state.showNoteForm = false;
                App.state.viewingUser = null;
                App.render.app();
            },
            
            setView(viewName) {
                App.state.activeView = viewName;
                App.state.showNoteForm = false;
                App.state.editingNote = null;
                App.state.viewingUser = null;
                App.render.app();
                App.render.view(viewName);
            },
            
            newNote() {
                App.state.showNoteForm = true;
                App.state.editingNote = null;
                App.render.view('notes');
            },
            
            editNote(noteId) {
                const note = App.state.notes.find(n => n.id == noteId);
                if (note && App.utils.canEditNote(note)) {
                    App.state.editingNote = note;
                    App.state.showNoteForm = true;
                    App.render.view('notes');
                }
            },
            
            cancelNote() {
                App.state.showNoteForm = false;
                App.state.editingNote = null;
                App.render.view('notes');
            },
            
            async saveNote(e) {
                e.preventDefault();
                const formData = new FormData(e.target);
                const noteData = {
                    title: formData.get('title'),
                    content: formData.get('content'),
                    priority: formData.get('priority'),
                    category: formData.get('category'),
                    snow_ticket: formData.get('snow_ticket') || null
                };
                
                if (App.state.editingNote) {
                    noteData.status = formData.get('status');
                }
                
                try {
                    let savedNote;
                    if (App.state.editingNote) {
                        savedNote = await App.api.updateNote(App.state.editingNote.id, noteData);
                    } else {
                        savedNote = await App.api.createNote(noteData);
                    }
                    
                    // Upload files if any are selected
                    const fileInput = document.getElementById('file-input');
                    if (fileInput && fileInput.files.length > 0) {
                        App.state.uploadingFiles = true;
                        try {
                            await App.api.uploadFiles(savedNote.id, fileInput.files);
                        } catch (error) {
                            console.error('File upload error:', error);
                            alert('Note saved but file upload failed: ' + error.message);
                        }
                        App.state.uploadingFiles = false;
                    }
                    
                    // Refresh data
                    await App.api.fetchData(App.state.token);
                    App.state.showNoteForm = false;
                    App.state.editingNote = null;
                    App.render.view('notes');
                } catch (error) {
                    alert('Error saving note: ' + error.message);
                }
            },
            
            async deleteNote(noteId) {
                const note = App.state.notes.find(n => n.id == noteId);
                if (!note || !App.utils.canDeleteNote(note)) return;
                
                if (confirm('Are you sure you want to delete this note? This will also delete all attached files.')) {
                    try {
                        await App.api.deleteNote(noteId);
                        await App.api.fetchData(App.state.token);
                        App.render.view(App.state.activeView);
                    } catch (error) {
                        alert('Error deleting note: ' + error.message);
                    }
                }
            },
            
            async deleteFile(fileId) {
                if (confirm('Are you sure you want to delete this file?')) {
                    try {
                        await App.api.deleteFile(fileId);
                        
                        // If editing note, refresh the form
                        if (App.state.editingNote) {
                            // Remove file from current note's attachments
                            App.state.editingNote.attachments = App.state.editingNote.attachments.filter(f => f.id != fileId);
                            App.render.view('notes');
                        } else {
                            // Refresh data
                            await App.api.fetchData(App.state.token);
                            App.render.view(App.state.activeView);
                        }
                    } catch (error) {
                        alert('Error deleting file: ' + error.message);
                    }
                }
            },
            
            setupFileUpload() {
                const fileInput = document.getElementById('file-input');
                const fileSelectBtn = document.getElementById('file-select-btn');
                const dropZone = document.getElementById('file-drop-zone');
                const selectedFiles = document.getElementById('selected-files');
                const fileList = document.getElementById('file-list');
                
                if (!fileInput || !fileSelectBtn || !dropZone) return;
                
                // File select button click
                fileSelectBtn.addEventListener('click', () => fileInput.click());
                
                // File input change
                fileInput.addEventListener('change', (e) => {
                    App.handlers.displaySelectedFiles(e.target.files);
                });
                
                // Drag and drop events
                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.classList.add('border-blue-400', 'bg-blue-50');
                });
                
                dropZone.addEventListener('dragleave', () => {
                    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
                });
                
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        fileInput.files = files;
                        App.handlers.displaySelectedFiles(files);
                    }
                });
            },
            
            displaySelectedFiles(files) {
                const selectedFiles = document.getElementById('selected-files');
                const fileList = document.getElementById('file-list');
                
                if (!selectedFiles || !fileList) return;
                
                if (files.length === 0) {
                    selectedFiles.classList.add('hidden');
                    return;
                }
                
                selectedFiles.classList.remove('hidden');
                fileList.innerHTML = '';
                
                Array.from(files).forEach((file, index) => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
                    fileItem.innerHTML = `
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl">${App.utils.getFileIcon(file.type)}</span>
                            <div>
                                <p class="font-medium text-sm text-gray-900">${file.name}</p>
                                <p class="text-xs text-gray-500">${App.utils.formatFileSize(file.size)}</p>
                            </div>
                        </div>
                        <button type="button" data-remove-file="${index}" class="text-red-600 hover:text-red-800 text-sm">
                            Remove
                        </button>
                    `;
                    fileList.appendChild(fileItem);
                });
                
                // Add remove file event listeners
                fileList.addEventListener('click', (e) => {
                    if (e.target.dataset.removeFile !== undefined) {
                        const index = parseInt(e.target.dataset.removeFile);
                        App.handlers.removeFile(index);
                    }
                });
            },
            
            removeFile(index) {
                const fileInput = document.getElementById('file-input');
                if (!fileInput) return;
                
                const dt = new DataTransfer();
                const files = Array.from(fileInput.files);
                
                files.forEach((file, i) => {
                    if (i !== index) {
                        dt.items.add(file);
                    }
                });
                
                fileInput.files = dt.files;
                App.handlers.displaySelectedFiles(fileInput.files);
            },
            
            viewUserNotes(userId, userName) {
                const user = App.state.users.find(u => u.id == userId);
                if (user) {
                    App.state.viewingUser = user;
                    App.state.activeView = 'user-notes';
                    App.render.app();
                    App.render.view('user-notes');
                }
            },
            
            async loadUserNotes() {
                if (!App.state.viewingUser) return;
                
                const monthSelect = document.getElementById('month-select');
                const yearSelect = document.getElementById('year-select');
                const container = document.getElementById('user-notes-container');
                
                if (!monthSelect || !yearSelect || !container) return;
                
                const month = parseInt(monthSelect.value);
                const year = parseInt(yearSelect.value);
                
                App.state.selectedMonth = month;
                App.state.selectedYear = year;
                
                try {
                    container.innerHTML = '<div class="p-8 text-center text-gray-500">Loading...</div>';
                    
                    const notes = await App.api.fetchUserNotes(App.state.viewingUser.id, year, month);
                    
                    if (notes.length === 0) {
                        container.innerHTML = `
                            <div class="p-12 text-center text-gray-500">
                                <div class="text-gray-400 text-6xl mb-4">📝</div>
                                <h3 class="text-xl font-semibold text-gray-600 mb-2">No notes found</h3>
                                <p class="text-gray-500">No notes found for ${App.utils.getMonthName(month)} ${year}</p>
                            </div>`;
                        return;
                    }
                    
                    container.innerHTML = `
                        <div class="space-y-4 p-6">
                            ${notes.map(note => `
                                <div class="bg-gray-50 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden group">
                                    <div class="p-6">
                                        <!-- Header with title and badges -->
                                        <div class="flex items-start justify-between mb-4">
                                            <div class="flex items-center space-x-3 flex-1">
                                                <h3 class="text-xl font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">${note.title}</h3>
                                                <div class="flex space-x-2">
                                                    <span class="px-3 py-1 text-xs font-medium rounded-full ${App.utils.getPriorityBadgeClass(note.priority)}">
                                                        ${note.priority.toUpperCase()}
                                                    </span>
                                                    <span class="px-3 py-1 text-xs font-medium rounded-full ${App.utils.getStatusBadgeClass(note.status)}">
                                                        ${note.status.toUpperCase()}
                                                    </span>
                                                    ${note.attachments && note.attachments.length > 0 ? `
                                                        <span class="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                                            📎 ${note.attachments.length} file${note.attachments.length > 1 ? 's' : ''}
                                                        </span>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                ${App.utils.canEditNote(note) ? `
                                                    <button data-action="edit-note" data-note-id="${note.id}" 
                                                            class="text-gray-500 hover:text-blue-600 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                                                        Edit
                                                    </button>
                                                ` : ''}
                                                ${App.utils.canDeleteNote(note) ? `
                                                    <button data-action="delete-note" data-note-id="${note.id}" 
                                                            class="text-gray-500 hover:text-red-600 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                                                        Delete
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </div>
                                        
                                        <!-- Note content -->
                                        <div class="text-gray-700 mb-4 note-content leading-relaxed max-h-64 overflow-y-auto">
                                            ${note.content}
                                        </div>
                                        
                                        <!-- File Attachments -->
                                        ${note.attachments && note.attachments.length > 0 ? `
                                            <div class="mb-4">
                                                <h4 class="text-sm font-medium text-gray-700 mb-3">Attachments:</h4>
                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    ${note.attachments.map(file => `
                                                        <div class="flex items-center space-x-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors border">
                                                            <span class="text-xl">${App.utils.getFileIcon(file.mime_type)}</span>
                                                            <div class="flex-1 min-w-0">
                                                                <p class="font-medium text-sm text-gray-900 truncate">${file.filename}</p>
                                                                <p class="text-xs text-gray-500">${App.utils.formatFileSize(file.size_bytes)}</p>
                                                            </div>
                                                            <a href="${App.api.getFileDownloadUrl(file.id)}" target="_blank"
                                                               class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                                Download
                                                            </a>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        
                                        <!-- Footer with metadata -->
                                        <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                                            <div class="flex items-center space-x-6 text-sm text-gray-500">
                                                ${note.snow_ticket ? `
                                                    <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                                                        SNOW: ${note.snow_ticket}
                                                    </span>
                                                ` : ''}
                                                <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium capitalize">
                                                    ${note.category}
                                                </span>
                                            </div>
                                            <div class="text-sm text-gray-500 font-medium">
                                                ${new Date(note.shift_date).toLocaleDateString('en-US', { 
                                                    weekday: 'short', 
                                                    year: 'numeric', 
                                                    month: 'short', 
                                                    day: 'numeric' 
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>`;
                } catch (error) {
                    container.innerHTML = `
                        <div class="p-12 text-center text-red-500">
                            <div class="text-red-400 text-6xl mb-4">⚠️</div>
                            <h3 class="text-xl font-semibold text-red-600 mb-2">Error loading notes</h3>
                            <p class="text-red-500">${error.message}</p>
                        </div>`;
                }
            },
            
            backToTeam() {
                App.state.viewingUser = null;
                App.handlers.setView('team');
            },
            
            async updateProfile(e) {
                e.preventDefault();
                const formData = new FormData(e.target);
                const userData = {
                    name: formData.get('name'),
                    email: formData.get('email')
                };
                
                try {
                    const updatedUser = await App.api.updateUser(App.state.currentUser.id, userData);
                    App.state.currentUser = updatedUser;
                    
                    // Update users list
                    const userIndex = App.state.users.findIndex(u => u.id === updatedUser.id);
                    if (userIndex !== -1) {
                        App.state.users[userIndex] = updatedUser;
                    }
                    
                    alert('Profile updated successfully!');
                    App.render.view('settings');
                } catch (error) {
                    alert('Error updating profile: ' + error.message);
                }
            },
            
            showAddUser() {
                document.getElementById('modal-container').innerHTML = App.render.addUserModal();
            },
            
            editUser(userId) {
                const user = App.state.users.find(u => u.id == userId);
                if (user) {
                    document.getElementById('modal-container').innerHTML = App.render.editUserModal(user);
                }
            },
            
            closeModal() {
                document.getElementById('modal-container').innerHTML = '';
            },
            
            async addUser(e) {
                e.preventDefault();
                const formData = new FormData(e.target);
                const userData = {
                    name: formData.get('name'),
                    email: formData.get('email'),
                    password: formData.get('password'),
                    role: formData.get('role')
                };
                
                try {
                    await App.api.createUser(userData);
                    await App.api.fetchData(App.state.token);
                    App.handlers.closeModal();
                    App.render.view('settings');
                    alert('User created successfully!');
                } catch (error) {
                    alert('Error creating user: ' + error.message);
                }
            },
            
            async updateUser(e) {
                e.preventDefault();
                const formData = new FormData(e.target);
                const userId = formData.get('userId');
                const userData = {
                    name: formData.get('name'),
                    email: formData.get('email'),
                    role: formData.get('role')
                };
                
                try {
                    await App.api.updateUser(userId, userData);
                    await App.api.fetchData(App.state.token);
                    App.handlers.closeModal();
                    App.render.view('settings');
                    alert('User updated successfully!');
                } catch (error) {
                    alert('Error updating user: ' + error.message);
                }
            },
            
            async deleteUser(userId, userName) {
                if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
                    try {
                        await App.api.deleteUser(userId);
                        await App.api.fetchData(App.state.token);
                        App.render.view('settings');
                        alert('User deleted successfully!');
                    } catch (error) {
                        alert('Error deleting user: ' + error.message);
                    }
                }
            },
            
            // Handle Google OAuth redirect
            handleOAuthRedirect() {
                const urlParams = new URLSearchParams(window.location.search);
                const token = urlParams.get('token');
                const userStr = urlParams.get('user');
                
                if (token && userStr) {
                    try {
                        const user = JSON.parse(decodeURIComponent(userStr));
                        App.state.token = token;
                        App.state.currentUser = user;
                        
                        // Clean URL
                        window.history.replaceState({}, document.title, window.location.pathname);
                        
                        // Load data and render
                        App.api.fetchData(App.state.token).then(() => {
                            App.render.app();
                            App.render.view('dashboard');
                        }).catch(() => {
                            App.render.app(); // Still show the app even if data fetch fails
                        });
                        
                        return true;
                    } catch (error) {
                        console.error('OAuth redirect error:', error);
                    }
                }
                return false;
            }
        },

        // --- INIT ---
        init() {
            // Check for OAuth redirect first
            if (App.handlers.handleOAuthRedirect()) {
                return; // OAuth handled, don't render login
            }
            
            document.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                
                switch (action) {
                    case 'logout':
                        App.handlers.logout();
                        break;
                    case 'set-view':
                        App.handlers.setView(e.target.dataset.view);
                        break;
                    case 'new-note':
                        App.handlers.newNote();
                        break;
                    case 'edit-note':
                        App.handlers.editNote(e.target.dataset.noteId);
                        break;
                    case 'delete-note':
                        App.handlers.deleteNote(e.target.dataset.noteId);
                        break;
                    case 'delete-file':
                        App.handlers.deleteFile(e.target.dataset.fileId);
                        break;
                    case 'cancel-note':
                        App.handlers.cancelNote();
                        break;
                    case 'view-user-notes':
                        App.handlers.viewUserNotes(e.target.dataset.userId, e.target.dataset.userName);
                        break;
                    case 'load-user-notes':
                        App.handlers.loadUserNotes();
                        break;
                    case 'back-to-team':
                        App.handlers.backToTeam();
                        break;
                    case 'show-add-user':
                        App.handlers.showAddUser();
                        break;
                    case 'edit-user':
                        App.handlers.editUser(e.target.dataset.userId);
                        break;
                    case 'delete-user':
                        App.handlers.deleteUser(e.target.dataset.userId, e.target.dataset.userName);
                        break;
                    case 'close-modal':
                        App.handlers.closeModal();
                        break;
                }
            });
            
            document.addEventListener('submit', (e) => {
                switch (e.target.id) {
                    case 'login-form':
                        App.handlers.login(e);
                        break;
                    case 'note-form':
                        App.handlers.saveNote(e);
                        break;
                    case 'profile-form':
                        App.handlers.updateProfile(e);
                        break;
                    case 'add-user-form':
                        App.handlers.addUser(e);
                        break;
                    case 'edit-user-form':
                        App.handlers.updateUser(e);
                        break;
                }
            });
            
            App.render.app();
        }
    };

    App.init();
});
