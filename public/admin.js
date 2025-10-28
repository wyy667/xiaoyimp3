// 元素引用
const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const filesList = document.getElementById('filesList');
const totalFiles = document.getElementById('totalFiles');
const totalSize = document.getElementById('totalSize');
const toast = document.getElementById('toast');
const announcementEnabled = document.getElementById('announcementEnabled');
const announcementInput = document.getElementById('announcementInput');
const saveAnnouncementBtn = document.getElementById('saveAnnouncementBtn');
const rateLimitEnabled = document.getElementById('rateLimitEnabled');
const maxUploads = document.getElementById('maxUploads');
const rateLimitConfig = document.getElementById('rateLimitConfig');
const saveRateLimitBtn = document.getElementById('saveRateLimitBtn');
const maxFileSize = document.getElementById('maxFileSize');
const saveFileSizeBtn = document.getElementById('saveFileSizeBtn');

// 检查登录状态
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();
        
        if (data.isLoggedIn) {
            showAdminView();
            loadFiles();
        } else {
            showLoginView();
        }
    } catch (error) {
        showLoginView();
    }
}

// 加载公告
async function loadAnnouncement() {
    try {
        const response = await fetch('/api/announcement');
        const data = await response.json();
        announcementEnabled.checked = data.enabled || false;
        announcementInput.value = data.content || '';
    } catch (error) {
        console.error('加载公告失败', error);
    }
}

// 保存公告
saveAnnouncementBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/admin/announcement', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: announcementInput.value,
                enabled: announcementEnabled.checked
            })
        });

        if (response.ok) {
            showToast('公告已保存');
        } else {
            const error = await response.json();
            showToast(error.error || '保存失败', true);
        }
    } catch (error) {
        showToast('保存失败', true);
    }
});

// 加载限流设置
async function loadRateLimit() {
    try {
        const response = await fetch('/api/admin/rate-limit');
        const data = await response.json();
        rateLimitEnabled.checked = data.enabled !== false;
        maxUploads.value = data.maxUploads || 3;
        updateRateLimitUI();
    } catch (error) {
        console.error('加载限流设置失败', error);
    }
}

// 更新限流UI
function updateRateLimitUI() {
    if (rateLimitEnabled.checked) {
        rateLimitConfig.style.opacity = '1';
        maxUploads.disabled = false;
    } else {
        rateLimitConfig.style.opacity = '0.5';
        maxUploads.disabled = true;
    }
}

// 限流开关变化
rateLimitEnabled.addEventListener('change', updateRateLimitUI);

// 保存限流设置
saveRateLimitBtn.addEventListener('click', async () => {
    try {
        const uploads = parseInt(maxUploads.value);
        
        if (rateLimitEnabled.checked && (isNaN(uploads) || uploads < 1 || uploads > 999)) {
            showToast('上传次数必须在1-999之间', true);
            return;
        }

        const response = await fetch('/api/admin/rate-limit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: rateLimitEnabled.checked,
                maxUploads: uploads
            })
        });

        if (response.ok) {
            showToast('限流设置已保存');
        } else {
            const error = await response.json();
            showToast(error.error || '保存失败', true);
        }
    } catch (error) {
        showToast('保存失败', true);
    }
});

// 加载文件大小设置
async function loadFileSize() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        maxFileSize.value = data.maxFileSize || 5;
    } catch (error) {
        console.error('加载文件大小设置失败', error);
    }
}

// 保存文件大小设置
saveFileSizeBtn.addEventListener('click', async () => {
    try {
        const size = parseInt(maxFileSize.value);
        
        if (isNaN(size) || size < 1 || size > 100) {
            showToast('文件大小必须在1-100MB之间', true);
            return;
        }

        const response = await fetch('/api/admin/file-size', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                maxFileSize: size
            })
        });

        if (response.ok) {
            showToast('文件大小限制已保存');
        } else {
            const error = await response.json();
            showToast(error.error || '保存失败', true);
        }
    } catch (error) {
        showToast('保存失败', true);
    }
});

// 显示登录界面
function showLoginView() {
    loginView.style.display = 'flex';
    adminView.style.display = 'none';
}

// 显示管理界面
function showAdminView() {
    loginView.style.display = 'none';
    adminView.style.display = 'block';
}

// 登录
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            showAdminView();
            loadFiles();
            loadAnnouncement();
            loadRateLimit();
            loadFileSize();
            showToast('登录成功');
        } else {
            const error = await response.json();
            showToast(error.error || '登录失败', true);
        }
    } catch (error) {
        showToast('登录失败', true);
    }
});

// 退出登录
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        showLoginView();
        showToast('已退出登录');
        loginForm.reset();
    } catch (error) {
        showToast('退出失败', true);
    }
});

// 加载文件列表
async function loadFiles() {
    try {
        const response = await fetch('/api/admin/files');
        if (!response.ok) {
            throw new Error('加载失败');
        }

        const files = await response.json();
        
        // 更新统计
        totalFiles.textContent = files.length;
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        totalSize.textContent = (totalBytes / 1024 / 1024).toFixed(2) + ' MB';

        // 渲染文件列表
        if (files.length === 0) {
            filesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>暂无文件</p>
                </div>
            `;
        } else {
            filesList.innerHTML = files.map(file => `
                <div class="file-item" data-id="${file.id}">
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(file.originalName)}</div>
                        <div class="file-meta">
                            ${formatFileSize(file.size)} · ${formatDate(file.uploadTime)}
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="action-btn play-btn" onclick="playFile('${file.url}')">播放</button>
                        <button class="action-btn delete-btn" onclick="deleteFile('${file.id}')">删除</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        showToast('加载文件列表失败', true);
    }
}

// 播放文件
function playFile(url) {
    window.open(url, '_blank');
}

// 删除文件
async function deleteFile(id) {
    if (!confirm('确定要删除这个文件吗？')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/files/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('删除成功');
            loadFiles();
        } else {
            const error = await response.json();
            showToast(error.error || '删除失败', true);
        }
    } catch (error) {
        showToast('删除失败', true);
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示提示消息
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.add('show');
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 页面加载时检查登录状态
checkAuth();

