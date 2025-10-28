// 元素引用
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const modal = document.getElementById('modal');
const modalFilename = document.getElementById('modalFilename');
const urlInput = document.getElementById('urlInput');
const copyBtn = document.getElementById('copyBtn');
const closeBtn = document.getElementById('closeBtn');
const toast = document.getElementById('toast');
const announcementModal = document.getElementById('announcementModal');
const announcementContent = document.getElementById('announcementContent');
const announcementCloseBtn = document.getElementById('announcementCloseBtn');
const announcementTimer = document.getElementById('announcementTimer');

// 全局配置
let systemConfig = {
    maxFileSize: 5
};

// 点击上传区域
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// 文件选择
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadFile(file);
    }
});

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        uploadFile(file);
    }
});

// 上传文件
async function uploadFile(file) {
    // 验证文件类型
    if (!file.name.toLowerCase().endsWith('.mp3')) {
        showToast('请上传MP3格式文件', true);
        return;
    }

    // 验证文件大小
    if (file.size > systemConfig.maxFileSize * 1024 * 1024) {
        showToast(`文件大小超过${systemConfig.maxFileSize}MB限制`, true);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // 显示进度条
    progressContainer.style.display = 'block';
    uploadArea.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = '上传中...';

    try {
        // 模拟进度动画
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 20;
                if (progress > 90) progress = 90;
                progressFill.style.width = progress + '%';
            }
        }, 200);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '上传失败');
        }

        const data = await response.json();

        // 完成动画
        progressFill.style.width = '100%';
        progressText.textContent = '上传完成';

        setTimeout(() => {
            // 显示结果弹窗（自动转换为https）
            modalFilename.textContent = data.originalName;
            urlInput.value = data.url.replace(/^http:/, 'https:');
            modal.classList.add('show');

            // 重置界面
            progressContainer.style.display = 'none';
            uploadArea.style.display = 'block';
            fileInput.value = '';
        }, 500);

    } catch (error) {
        progressContainer.style.display = 'none';
        uploadArea.style.display = 'block';
        showToast(error.message, true);
        fileInput.value = '';
    }
}

// 复制链接
copyBtn.addEventListener('click', () => {
    // 确保URL使用https协议（不管当前是什么状态）
    const url = urlInput.value.replace(/^http:/, 'https:');
    
    // 使用现代API复制
    navigator.clipboard.writeText(url).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '已复制';
        copyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)';
        }, 2000);
    }).catch(() => {
        // 降级方案：使用旧方法
        urlInput.select();
        document.execCommand('copy');
        
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '已复制';
        copyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)';
        }, 2000);
    });
});

// 关闭弹窗
closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

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

// 加载并显示公告
async function loadAnnouncement() {
    try {
        const response = await fetch('/api/announcement');
        const data = await response.json();
        
        if (data.enabled && data.content && data.content.trim()) {
            announcementContent.textContent = data.content;
            announcementModal.classList.add('show');
            
            // 3秒倒计时
            let countdown = 3;
            announcementCloseBtn.disabled = true;
            announcementCloseBtn.style.opacity = '0.5';
            announcementCloseBtn.style.cursor = 'not-allowed';
            
            const timer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    announcementTimer.textContent = `请阅读公告 (${countdown}秒)`;
                } else {
                    announcementTimer.textContent = '可以关闭了';
                    announcementCloseBtn.disabled = false;
                    announcementCloseBtn.style.opacity = '1';
                    announcementCloseBtn.style.cursor = 'pointer';
                    clearInterval(timer);
                }
            }, 1000);
        }
    } catch (error) {
        console.error('加载公告失败', error);
    }
}

// 关闭公告
announcementCloseBtn.addEventListener('click', () => {
    if (!announcementCloseBtn.disabled) {
        announcementModal.classList.remove('show');
    }
});

// 加载系统配置
async function loadSystemConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        systemConfig.maxFileSize = data.maxFileSize || 5;
        
        // 更新页面上的提示文字
        const uploadHint = document.querySelector('.upload-hint');
        if (uploadHint) {
            uploadHint.textContent = `仅支持MP3格式，最大${systemConfig.maxFileSize}MB`;
        }
    } catch (error) {
        console.error('加载系统配置失败', error);
    }
}

// 页面加载时执行
loadAnnouncement();
loadSystemConfig();

