const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// 读取配置文件
let config = { 
  admin: { username: 'admin', password: '' }, 
  port: 3000,
  rateLimit: { enabled: true, maxUploads: 3 },
  maxFileSize: 5
};
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config = { ...config, ...savedConfig };
  // 确保rateLimit配置存在
  if (!config.rateLimit) {
    config.rateLimit = { enabled: true, maxUploads: 3 };
  }
  // 确保maxFileSize配置存在
  if (!config.maxFileSize) {
    config.maxFileSize = 5;
  }
}

const PORT = config.port || 3000;

// 确保必要的目录存在
const dirs = ['uploads', 'data', 'public'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 初始化数据文件
const filesDataPath = path.join(__dirname, 'data', 'files.json');
const rateLimitPath = path.join(__dirname, 'data', 'rate-limit.json');
const announcementPath = path.join(__dirname, 'data', 'announcement.json');
const accessLogPath = path.join(__dirname, 'data', 'access-log.json');

if (!fs.existsSync(filesDataPath)) {
  fs.writeFileSync(filesDataPath, JSON.stringify([], null, 2), 'utf8');
}

if (!fs.existsSync(rateLimitPath)) {
  fs.writeFileSync(rateLimitPath, JSON.stringify({}, null, 2), 'utf8');
}

if (!fs.existsSync(announcementPath)) {
  fs.writeFileSync(announcementPath, JSON.stringify({ content: '', enabled: false }, null, 2), 'utf8');
}

if (!fs.existsSync(accessLogPath)) {
  fs.writeFileSync(accessLogPath, JSON.stringify({}, null, 2), 'utf8');
}

// 文件访问追踪中间件
function trackFileAccess(req, res, next) {
  // 只追踪 /uploads/ 下的音频文件访问
  if (req.path.startsWith('/uploads/') && req.path.endsWith('.mp3')) {
    const filename = path.basename(req.path);
    const now = Date.now();
    
    try {
      let accessLog = JSON.parse(fs.readFileSync(accessLogPath, 'utf8'));
      accessLog[filename] = now;
      fs.writeFileSync(accessLogPath, JSON.stringify(accessLog, null, 2), 'utf8');
      console.log(`文件访问: ${filename} (${new Date(now).toLocaleString()})`);
    } catch (error) {
      console.error('更新访问日志失败:', error.message);
    }
  }
  next();
}

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', trackFileAccess, express.static('uploads'));

// Session配置
app.use(session({
  secret: 'mp3-hosting-secret-key-' + Math.random().toString(36).substring(7),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24小时
}));

// Multer配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // 修复中文文件名
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 动态创建upload中间件
function createUploadMiddleware() {
  return multer({
    storage: storage,
    limits: {
      fileSize: (config.maxFileSize || 5) * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.mp3') {
        return cb(new Error('只允许上传MP3格式文件'));
      }
      cb(null, true);
    }
  }).single('file');
}

// IP限流中间件
function rateLimitMiddleware(req, res, next) {
  // 检查是否启用限流
  if (!config.rateLimit.enabled) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const maxUploads = config.rateLimit.maxUploads || 3;

  let rateLimitData = JSON.parse(fs.readFileSync(rateLimitPath, 'utf8'));

  // 清理过期记录
  if (rateLimitData[ip]) {
    rateLimitData[ip] = rateLimitData[ip].filter(timestamp => now - timestamp < oneHour);
  } else {
    rateLimitData[ip] = [];
  }

  // 检查上传次数
  if (rateLimitData[ip].length >= maxUploads) {
    return res.status(429).json({ 
      error: `上传次数过多，每60分钟限制${maxUploads}次，请稍后再试`,
      remainingTime: Math.ceil((oneHour - (now - rateLimitData[ip][0])) / 1000 / 60)
    });
  }

  // 记录本次请求
  rateLimitData[ip].push(now);
  fs.writeFileSync(rateLimitPath, JSON.stringify(rateLimitData, null, 2));

  next();
}

// 管理员认证中间件
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: '未授权' });
  }
}

// 路由：主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：管理员登录页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 路由：管理员登录
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === config.admin.username && 
      await bcrypt.compare(password, config.admin.password)) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 路由：管理员登出
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 路由：检查登录状态
app.get('/api/admin/check', (req, res) => {
  res.json({ isLoggedIn: !!req.session.isAdmin });
});

// 路由：上传文件
app.post('/api/upload', rateLimitMiddleware, (req, res) => {
  const uploadMiddleware = createUploadMiddleware();
  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `文件大小超过${config.maxFileSize}MB限制` });
      }
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    handleUpload(req, res);
  });
});

function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件被上传' });
    }

    const filesData = JSON.parse(fs.readFileSync(filesDataPath, 'utf8'));
    
    const fileInfo = {
      id: req.file.filename,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      uploadTime: new Date().toISOString(),
      url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    };

    filesData.push(fileInfo);
    fs.writeFileSync(filesDataPath, JSON.stringify(filesData, null, 2), 'utf8');

    // 记录初始访问时间
    try {
      let accessLog = JSON.parse(fs.readFileSync(accessLogPath, 'utf8'));
      accessLog[req.file.filename] = Date.now();
      fs.writeFileSync(accessLogPath, JSON.stringify(accessLog, null, 2), 'utf8');
    } catch (error) {
      console.error('记录访问时间失败:', error.message);
    }

    res.json({
      success: true,
      url: fileInfo.url,
      originalName: fileInfo.originalName
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
}

// 路由：获取所有文件（管理员）
app.get('/api/admin/files', requireAuth, (req, res) => {
  try {
    const filesData = JSON.parse(fs.readFileSync(filesDataPath, 'utf8'));
    res.json(filesData.reverse()); // 最新的在前面
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 路由：删除文件（管理员）
app.delete('/api/admin/files/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    let filesData = JSON.parse(fs.readFileSync(filesDataPath, 'utf8'));
    
    const fileIndex = filesData.findIndex(f => f.id === id);
    if (fileIndex === -1) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const filename = filesData[fileIndex].filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    
    // 删除物理文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除文件记录
    filesData = filesData.filter(f => f.id !== id);
    fs.writeFileSync(filesDataPath, JSON.stringify(filesData, null, 2), 'utf8');

    // 删除访问日志记录
    try {
      let accessLog = JSON.parse(fs.readFileSync(accessLogPath, 'utf8'));
      delete accessLog[filename];
      fs.writeFileSync(accessLogPath, JSON.stringify(accessLog, null, 2), 'utf8');
    } catch (error) {
      console.error('删除访问日志失败:', error.message);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 路由：获取公告
app.get('/api/announcement', (req, res) => {
  try {
    const announcement = JSON.parse(fs.readFileSync(announcementPath, 'utf8'));
    res.json(announcement);
  } catch (error) {
    res.json({ content: '', enabled: false });
  }
});

// 路由：设置公告（管理员）
app.post('/api/admin/announcement', requireAuth, (req, res) => {
  try {
    const { content, enabled } = req.body;
    const announcement = { content, enabled };
    fs.writeFileSync(announcementPath, JSON.stringify(announcement, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 路由：获取限流设置（管理员）
app.get('/api/admin/rate-limit', requireAuth, (req, res) => {
  try {
    res.json(config.rateLimit);
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 路由：设置限流（管理员）
app.post('/api/admin/rate-limit', requireAuth, (req, res) => {
  try {
    const { enabled, maxUploads } = req.body;
    
    // 验证参数
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '参数错误' });
    }
    
    if (enabled && (!Number.isInteger(maxUploads) || maxUploads < 1 || maxUploads > 999)) {
      return res.status(400).json({ error: '上传次数必须在1-999之间' });
    }
    
    // 更新配置
    config.rateLimit = { enabled, maxUploads: enabled ? maxUploads : 3 };
    
    // 保存到配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 路由：获取系统配置（供前端获取文件大小限制等）
app.get('/api/config', (req, res) => {
  try {
    res.json({
      maxFileSize: config.maxFileSize || 5
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 路由：设置文件大小限制（管理员）
app.post('/api/admin/file-size', requireAuth, (req, res) => {
  try {
    const { maxFileSize } = req.body;
    
    // 验证参数
    if (!Number.isInteger(maxFileSize) || maxFileSize < 1 || maxFileSize > 100) {
      return res.status(400).json({ error: '文件大小必须在1-100MB之间' });
    }
    
    // 更新配置
    config.maxFileSize = maxFileSize;
    
    // 保存到配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `文件大小超过${config.maxFileSize || 5}MB限制` });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || '服务器错误' });
});

// 自动清理过期文件（超过24小时未访问）
function cleanExpiredFiles() {
  try {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000; // 24小时（毫秒）
    
    let accessLog = JSON.parse(fs.readFileSync(accessLogPath, 'utf8'));
    let filesData = JSON.parse(fs.readFileSync(filesDataPath, 'utf8'));
    
    let deletedCount = 0;
    const filesToDelete = [];
    
    // 遍历访问日志，找出过期文件
    for (const [filename, lastAccess] of Object.entries(accessLog)) {
      const timeSinceLastAccess = now - lastAccess;
      
      if (timeSinceLastAccess > expireTime) {
        filesToDelete.push(filename);
      }
    }
    
    // 删除过期文件
    for (const filename of filesToDelete) {
      const filePath = path.join(__dirname, 'uploads', filename);
      
      // 删除物理文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`已删除过期文件: ${filename} (超过24小时未访问)`);
      }
      
      // 从数据库中删除记录
      filesData = filesData.filter(f => f.filename !== filename);
      
      // 从访问日志中删除
      delete accessLog[filename];
    }
    
    // 保存更新后的数据
    if (deletedCount > 0) {
      fs.writeFileSync(filesDataPath, JSON.stringify(filesData, null, 2), 'utf8');
      fs.writeFileSync(accessLogPath, JSON.stringify(accessLog, null, 2), 'utf8');
      console.log(`自动清理完成: 共删除 ${deletedCount} 个过期文件`);
    } else {
      console.log('自动清理检查: 没有过期文件需要删除');
    }
  } catch (error) {
    console.error('自动清理失败:', error.message);
  }
}

// 服务器启动
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`主页: http://localhost:${PORT}`);
  console.log(`管理后台: http://localhost:${PORT}/admin`);
  console.log('自动清理功能已启动: 每1小时检查一次过期文件（24小时未访问）');
  
  // 启动时立即执行一次清理
  cleanExpiredFiles();
  
  // 每1小时执行一次清理
  setInterval(cleanExpiredFiles, 60 * 60 * 1000);
});

