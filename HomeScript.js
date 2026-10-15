// --- CONFIGURATION ---
const SUPABASE_URL = 'https://wadjthlbvlibpegzhsgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZGp0aGxidmxpYnBlZ3poc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMzE4ODcsImV4cCI6MjEwNzYwNzg4N30.rW7UF0ZQl48WRp7ZqGmzBYSRkv_6X3crz6iPqySg1fw';
const CLOUDINARY_CLOUD_NAME = 'skppslpm';
const PHOTO_UPLOAD_PRESET = 'PhotoUploadPreset';
// ---------------------

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let uploadedPhotoUrl = '';
let selectedPdfFile = null;

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
                <button class="link-btn" onclick="openModal('${escapeHtml(item.title)}', '${escapeHtml(item.file_url)}', '${tableName}')">🔍 View File</button>
                <button class="link-btn" onclick="downloadFile('${escapeHtml(item.file_url)}', '${escapeHtml(item.title)}')">📥 Download File</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// Add dynamic secret row for vault
function addSecretRow(key = '', value = '') {
    const container = document.getElementById('secrets-container');
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

// Initialize default fields on load
document.addEventListener('DOMContentLoaded', () => {
    addSecretRow('username', '');
    addSecretRow('password', '');
    fetchFiles('photos', 'photo-list');
});

// Handle Password/Vault Submit
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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

    const { error } = await supabaseClient.from('passwords').insert([
        { site_name, secrets }
    ]);

    setLoading(submitBtn, false, 'Save Account Details');

    if (error) {
        alert('Error saving details: ' + error.message);
    } else {
        document.getElementById('password-form').reset();
        document.getElementById('secrets-container').innerHTML = '<h3>Secret Fields</h3>';
        addSecretRow('username', '');
        addSecretRow('password', '');
        fetchPasswords();
    }
});

// Fetch Passwords & Secrets
async function fetchPasswords() {
    const listContainer = document.getElementById('password-list');
    listContainer.innerHTML = '';

    const { data, error } = await supabaseClient
        .from('passwords')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        listContainer.innerHTML = '<p>Error loading vault items.</p>';
        return;
    }

    if (data.length === 0) {
        listContainer.innerHTML = '<p>No saved accounts found.</p>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        let secretsHtml = '';
        for (const [key, val] of Object.entries(item.secrets || {})) {
            const lowerKey = key.toLowerCase();
            const isSensitive = lowerKey.includes('pass') || lowerKey.includes('pin') || lowerKey.includes('code') || lowerKey.includes('secret');
            
            if (isSensitive) {
                secretsHtml += `
                    <p><strong>${escapeHtml(key)}:</strong> 
                       <span class="masked-pass">••••••••</span> 
                       <button type="button" onclick="togglePass(this, '${escapeHtml(val)}')">👁️</button>
                    </p>`;
            } else {
                secretsHtml += `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</p>`;
            }
        }

        card.innerHTML = `
            <div style="width: 100%;">
                <h3>${escapeHtml(item.site_name)}</h3>
                <div class="secrets-box" style="margin-top: 8px;">${secretsHtml}</div>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// Modal handling
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

// Robust Blob download helper for Supabase and Cloudinary files
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
        // Fallback open in new tab if CORS blocks fetch
        window.open(url, '_blank');
    }
};

// Button loading state helper
function setLoading(button, isLoading, text) {
    button.disabled = isLoading;
    button.innerText = text;
}

// Simple reveal password toggle
window.togglePass = function(btn, plainPass) {
    const span = btn.previousElementSibling;
    if (span.innerText === '••••••••') {
        span.innerText = plainPass;
        btn.innerText = '🔒';
    } else {
        span.innerText = '••••••••';
        btn.innerText = '👁️';
    }
};

function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}