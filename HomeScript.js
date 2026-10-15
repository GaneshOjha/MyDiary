// --- CONFIGURATION ---
const SUPABASE_URL = 'https://wadjthlbvlibpegzhsgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZGp0aGxidmxpYnBlZ3poc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMzE4ODcsImV4cCI6MjEwNzYwNzg4N30.rW7UF0ZQl48WRp7ZqGmzBYSRkv_6X3crz6iPqySg1fw';
const CLOUDINARY_CLOUD_NAME = 'skppslpm';
const PHOTO_UPLOAD_PRESET = 'PhotoUploadPreset';
// ---------------------

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: window.sessionStorage,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false
    }
});

let uploadedPhotoUrl = '';
let selectedPdfFile = null;
let vaultRecords = [];

// Safe session check on page load for Android/PWA
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) {
            showLogin();
        } else {
            showApp();
        }
    } catch (err) {
        showLogin();
    }
});

// Show/Hide Password Toggle for Login Screen (Mobile Compatible)
window.toggleLoginPassword = function(btn) {
    const passInput = document.getElementById('auth-password');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        btn.innerText = '🔒';
    } else {
        passInput.type = 'password';
        btn.innerText = '👁️';
    }
};

// Handle Login Form Submit
window.handleLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');

    setLoading(submitBtn, true, 'Logging in...');
    errorMsg.style.display = 'none';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            setLoading(submitBtn, false, 'Login to Vault');
            errorMsg.innerText = error.message;
            errorMsg.style.display = 'block';
        } else {
            showApp();
        }
    } catch (err) {
        setLoading(submitBtn, false, 'Login to Vault');
        errorMsg.innerText = 'Login failed. Please check your connection.';
        errorMsg.style.display = 'block';
    }
};

// Handle Logout
window.handleLogout = async function() {
    await supabaseClient.auth.signOut();
    showLogin();
};

// Open Change Password Modal
window.openChangePasswordModal = function() {
    document.getElementById('modal-title').innerText = 'Change Master Password';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <form id="change-pass-form" onsubmit="submitNewPassword(event)" style="background: transparent; border: none; padding: 0;">
            <p style="color: var(--text-muted); margin-bottom: 10px;">Enter your new master account password below:</p>
            <input type="password" id="new-password" placeholder="New Password (min 6 characters)" required style="margin-bottom: 10px;">
            <button type="submit" id="change-pass-btn" class="primary-btn">Update Password</button>
        </form>
    `;
    document.getElementById('preview-modal').style.display = 'flex';
};

// Submit New Password to Supabase
window.submitNewPassword = async function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const btn = document.getElementById('change-pass-btn');

    setLoading(btn, true, 'Updating...');

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    setLoading(btn, false, 'Update Password');

    if (error) {
        alert('Error updating password: ' + error.message);
    } else {
        alert('Password updated successfully!');
        closeModal();
    }
};

function showLogin() {
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    const form = document.getElementById('auth-form');
    if (form) form.reset();
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    const container = document.getElementById('secrets-container');
    if (container) {
        container.innerHTML = '<h3>Secret Fields</h3>';
        addSecretRow('username', '');
        addSecretRow('password', '');
    }
    fetchFiles('photos', 'photo-list');
}

// Tab switching logic
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    if (tabName === 'photos') {
        document.getElementById('photos-section').classList.add('active');
        event.currentTarget.classList.add('active');
        fetchFiles('photos', 'photo-list');
    } else if (tabName === 'pdfs') {
        document.getElementById('pdfs-section').classList.add('active');
        event.currentTarget.classList.add('active');
        fetchFiles('pdfs', 'pdf-list');
    } else {
        document.getElementById('passwords-section').classList.add('active');
        event.currentTarget.classList.add('active');
        fetchPasswords();
    }
}

// Cloudinary Widget for Photos
const photoUploadWidget = cloudinary.createUploadWidget(
    {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: PHOTO_UPLOAD_PRESET,
        resourceType: 'image',
    },
    (error, result) => {
        if (!error && result && result.event === 'success') {
            uploadedPhotoUrl = result.info.secure_url;
            document.getElementById('photo-file-status').innerText = `Chosen: ${result.info.original_filename}`;
            document.getElementById('photo-file-status').style.color = '#38bdf8';
        }
    }
);

document.getElementById('photo-upload-btn').addEventListener('click', () => {
    photoUploadWidget.open();
});

// Native file selector for PDFs
document.getElementById('pdf-file-input').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        selectedPdfFile = e.target.files[0];
        document.getElementById('pdf-file-status').innerText = `Chosen: ${selectedPdfFile.name}`;
        document.getElementById('pdf-file-status').style.color = '#38bdf8';
    }
});

document.getElementById('pdf-upload-btn').addEventListener('click', () => {
    document.getElementById('pdf-file-input').click();
});

// Handle Photo Form Submit
document.getElementById('photo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('photo-title').value;
    const submitBtn = document.getElementById('photo-submit-btn');

    if (!uploadedPhotoUrl) {
        alert('Please select and upload a photo file first.');
        return;
    }

    setLoading(submitBtn, true, 'Saving Photo...');

    const { error } = await supabaseClient.from('photos').insert([
        { title, file_url: uploadedPhotoUrl }
    ]);

    setLoading(submitBtn, false, 'Save Photo Entry');

    if (error) {
        alert('Error saving photo: ' + error.message);
    } else {
        document.getElementById('photo-form').reset();
        uploadedPhotoUrl = '';
        document.getElementById('photo-file-status').innerText = 'No file chosen';
        document.getElementById('photo-file-status').style.color = 'var(--text-muted)';
        fetchFiles('photos', 'photo-list');
    }
});

// Handle PDF Form Submit (Uploads to Supabase Storage bucket)
document.getElementById('pdf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('pdf-title').value;
    const submitBtn = document.getElementById('pdf-submit-btn');

    if (!selectedPdfFile) {
        alert('Please choose a PDF file first.');
        return;
    }

    setLoading(submitBtn, true, 'Uploading PDF...');

    const fileName = `${Date.now()}_${selectedPdfFile.name}`;
    const { error: uploadError } = await supabaseClient.storage
        .from('vault-files')
        .upload(fileName, selectedPdfFile);

    if (uploadError) {
        setLoading(submitBtn, false, 'Save PDF Entry');
        alert('Error uploading PDF: ' + uploadError.message);
        return;
    }

    const { data: publicUrlData } = supabaseClient.storage
        .from('vault-files')
        .getPublicUrl(fileName);

    const file_url = publicUrlData.publicUrl;

    const { error: dbError } = await supabaseClient.from('pdfs').insert([
        { title, file_url }
    ]);

    setLoading(submitBtn, false, 'Save PDF Entry');

    if (dbError) {
        alert('Error saving PDF record: ' + dbError.message);
    } else {
        document.getElementById('pdf-form').reset();
        selectedPdfFile = null;
        document.getElementById('pdf-file-status').innerText = 'No file chosen';
        document.getElementById('pdf-file-status').style.color = 'var(--text-muted)';
        fetchFiles('pdfs', 'pdf-list');
    }
});

// Generic Fetch Files for Photos/PDFs
async function fetchFiles(tableName, containerId) {
    const listContainer = document.getElementById(containerId);
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        listContainer.innerHTML = '<p>Error loading records.</p>';
        return;
    }

    if (data.length === 0) {
        listContainer.innerHTML = '<p>No records found.</p>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${escapeHtml(item.title)}</h3>
            <div class="card-actions">
                <button class="link-btn" onclick="openModal('${escapeHtml(item.title)}', '${escapeHtml(item.file_url)}', '${tableName}')">🔍 View</button>
                <button class="link-btn" onclick="downloadFile('${escapeHtml(item.file_url)}', '${escapeHtml(item.title)}')">📥 Download</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// Add dynamic secret row for vault
function addSecretRow(key = '', value = '') {
    const container = document.getElementById('secrets-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'secret-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';

    row.innerHTML = `
        <input type="text" placeholder="Variable Name (e.g., PIN)" class="secret-key" value="${escapeHtml(key)}" required style="flex: 1;">
        <input type="text" placeholder="Value / Secret" class="secret-val" value="${escapeHtml(value)}" required style="flex: 2;">
        <button type="button" class="secondary-btn" onclick="this.parentElement.remove()" style="padding: 5px 10px;">❌</button>
    `;
    container.appendChild(row);
}

// Handle Password/Vault Submit
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-password-id').value;
    const site_name = document.getElementById('site-name').value;
    const submitBtn = document.getElementById('password-submit-btn');
    
    const secrets = {};
    const rows = document.querySelectorAll('.secret-row');
    rows.forEach(row => {
        const k = row.querySelector('.secret-key').value.trim();
        const v = row.querySelector('.secret-val').value.trim();
        if (k) {
            secrets[k] = v;
        }
    });

    setLoading(submitBtn, true, 'Saving Secrets...');

    let error;
    if (editId) {
        const res = await supabaseClient.from('passwords').update({ site_name, secrets }).eq('id', editId);
        error = res.error;
    } else {
        const res = await supabaseClient.from('passwords').insert([{ site_name, secrets }]);
        error = res.error;
    }

    setLoading(submitBtn, false, editId ? 'Update Account Details' : 'Save Account Details');

    if (error) {
        alert('Error saving details: ' + error.message);
    } else {
        resetPasswordForm();
        fetchPasswords();
    }
});

function resetPasswordForm() {
    document.getElementById('password-form').reset();
    document.getElementById('edit-password-id').value = '';
    document.getElementById('password-form-title').innerText = 'Add Account & Secrets';
    document.getElementById('password-submit-btn').innerText = 'Save Account Details';
    document.getElementById('secrets-container').innerHTML = '<h3>Secret Fields</h3>';
    addSecretRow('username', '');
    addSecretRow('password', '');
}

// Fetch Passwords & Secrets
async function fetchPasswords() {
    const listContainer = document.getElementById('password-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const { data, error } = await supabaseClient
        .from('passwords')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        listContainer.innerHTML = '<p>Error loading vault items.</p>';
        return;
    }

    vaultRecords = data || [];

    if (vaultRecords.length === 0) {
        listContainer.innerHTML = '<p>No saved accounts found.</p>';
        return;
    }

    vaultRecords.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        card.innerHTML = `
            <h3>${escapeHtml(item.site_name)}</h3>
            <div class="card-actions">
                <button class="link-btn" onclick="openVaultModal('${item.id}')">🔍 View</button>
                <button class="link-btn" onclick="editVaultRecord('${item.id}')">✏️ Edit</button>
                <button class="link-btn danger" onclick="deleteVaultRecord('${item.id}')">🗑️ Delete</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

window.openVaultModal = function(id) {
    const item = vaultRecords.find(r => r.id === id);
    if (!item) return;

    document.getElementById('modal-title').innerText = item.site_name;
    const body = document.getElementById('modal-body');
    
    let secretsHtml = '';
    for (const [key, val] of Object.entries(item.secrets || {})) {
        const lowerKey = key.toLowerCase();
        const isSensitive = lowerKey.includes('pass') || lowerKey.includes('pin') || lowerKey.includes('code') || lowerKey.includes('secret');
        
        if (isSensitive) {
            secretsHtml += `
                <p style="margin: 6px 0;"><strong>${escapeHtml(key)}:</strong> 
                   <span class="masked-pass">••••••••</span> 
                   <button type="button" class="link-btn" style="padding: 2px 6px; margin-left: 5px;" onclick="togglePass(this, '${escapeHtml(val)}')">👁️ Reveal</button>
                </p>`;
        } else {
            secretsHtml += `<p style="margin: 6px 0;"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</p>`;
        }
    }

    body.innerHTML = `<div style="padding: 10px;">${secretsHtml}</div>`;
    document.getElementById('preview-modal').style.display = 'flex';
};

window.editVaultRecord = function(id) {
    const item = vaultRecords.find(r => r.id === id);
    if (!item) return;

    document.getElementById('edit-password-id').value = item.id;
    document.getElementById('site-name').value = item.site_name;
    document.getElementById('password-form-title').innerText = `Edit Account: ${item.site_name}`;
    document.getElementById('password-submit-btn').innerText = 'Update Account Details';

    const container = document.getElementById('secrets-container');
    container.innerHTML = '<h3>Secret Fields</h3>';

    for (const [key, val] of Object.entries(item.secrets || {})) {
        addSecretRow(key, val);
    }

    document.getElementById('password-form').scrollIntoView({ behavior: 'smooth' });
};

window.deleteVaultRecord = async function(id) {
    if (!confirm('Are you sure you want to delete this account record?')) return;

    const { error } = await supabaseClient.from('passwords').delete().eq('id', id);

    if (error) {
        alert('Error deleting record: ' + error.message);
    } else {
        fetchPasswords();
    }
};

window.openModal = function(title, url, type) {
    document.getElementById('modal-title').innerText = title;
    const body = document.getElementById('modal-body');
    
    if (type === 'photos') {
        body.innerHTML = `<img src="${url}" alt="${title}">`;
    } else {
        body.innerHTML = `<embed src="${url}" type="application/pdf">`;
    }
    
    document.getElementById('preview-modal').style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('preview-modal').style.display = 'none';
    document.getElementById('modal-body').innerHTML = '';
};

window.downloadFile = async function(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        window.open(url, '_blank');
    }
};

function setLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    button.innerText = text;
}

window.togglePass = function(btn, plainPass) {
    const span = btn.previousElementSibling;
    if (span.innerText === '••••••••') {
        span.innerText = plainPass;
        btn.innerText = '🔒 Hide';
    } else {
        span.innerText = '••••••••';
        btn.innerText = '👁️ Reveal';
    }
};

function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}