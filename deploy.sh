#!/bin/bash

echo "========================================="
echo "  MP3外链盘 - 部署脚本"
echo "========================================="
echo ""

# 检查是否为root用户
if [ "$EUID" -eq 0 ]; then 
    echo "警告: 建议不要使用root用户运行此脚本"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检测并安装Node.js
echo "检查Node.js..."
if ! command -v node &> /dev/null; then
    echo "未检测到Node.js，正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js已安装: $(node -v)"
fi

# 检测并安装npm
if ! command -v npm &> /dev/null; then
    echo "未检测到npm，正在安装..."
    sudo apt-get install -y npm
else
    echo "npm已安装: $(npm -v)"
fi

# 检测并安装PM2（用于后台运行）
echo "检查PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "未检测到PM2，正在安装..."
    sudo npm install -g pm2
else
    echo "PM2已安装: $(pm2 -v)"
fi

echo ""
echo "依赖检查完成"
echo ""

# 安装项目依赖
echo "安装项目依赖..."
npm install

# 询问端口
echo ""
read -p "请输入运行端口 (默认3000): " PORT
PORT=${PORT:-3000}

# 询问管理员用户名
echo ""
read -p "请输入管理员用户名 (默认admin): " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

# 询问管理员密码
echo ""
read -sp "请输入管理员密码 (默认admin): " ADMIN_PASS
ADMIN_PASS=${ADMIN_PASS:-admin}
echo ""

# 询问是否后台运行
echo ""
read -p "是否使用PM2后台运行? (y/n, 默认y): " RUN_BACKGROUND
RUN_BACKGROUND=${RUN_BACKGROUND:-y}

# 生成密码哈希
echo ""
echo "正在生成配置..."
HASHED_PASS=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$ADMIN_PASS', 10));")

# 创建配置文件
cat > config.json << EOF
{
  "port": $PORT,
  "admin": {
    "username": "$ADMIN_USER",
    "password": "$HASHED_PASS"
  }
}
EOF

echo "配置文件已创建"

# 创建必要的目录
mkdir -p uploads data public

# 启动服务
echo ""
echo "========================================="
if [[ $RUN_BACKGROUND =~ ^[Yy]$ ]]; then
    echo "正在使用PM2启动服务..."
    pm2 delete mp3-hosting 2>/dev/null || true
    pm2 start server.js --name mp3-hosting
    pm2 save
    
    # 设置开机自启
    echo ""
    read -p "是否设置开机自启? (y/n, 默认n): " AUTO_START
    if [[ $AUTO_START =~ ^[Yy]$ ]]; then
        sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
        pm2 save
        echo "已设置开机自启"
    fi
    
    echo ""
    echo "部署完成！"
    echo ""
    echo "服务已在后台运行"
    echo "访问地址: http://localhost:$PORT"
    echo "管理后台: http://localhost:$PORT/admin"
    echo ""
    echo "常用命令:"
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs mp3-hosting"
    echo "  重启服务: pm2 restart mp3-hosting"
    echo "  停止服务: pm2 stop mp3-hosting"
    echo "  删除服务: pm2 delete mp3-hosting"
else
    echo "正在启动服务..."
    echo ""
    echo "部署完成！"
    echo ""
    echo "访问地址: http://localhost:$PORT"
    echo "管理后台: http://localhost:$PORT/admin"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo ""
    echo "========================================="
    echo ""
    node server.js
fi



