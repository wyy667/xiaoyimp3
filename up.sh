#!/bin/bash

echo "========================================="
echo "  MP3外链盘 - 升级脚本"
echo "========================================="
echo ""

# 检查config.json是否存在
if [ ! -f "config.json" ]; then
    echo "错误: 未找到config.json，请先运行deploy.sh进行部署"
    exit 1
fi

# 备份配置和数据
echo "备份配置和数据..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r config.json data uploads $BACKUP_DIR/ 2>/dev/null || true
echo "备份已保存到: $BACKUP_DIR"

# 检查是否使用PM2运行
PM2_RUNNING=false
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "mp3-hosting"; then
        PM2_RUNNING=true
        echo ""
        echo "检测到服务正在通过PM2运行"
        echo "升级过程中服务将短暂停止"
        read -p "是否继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# 安装/更新依赖
echo ""
echo "更新依赖包..."
npm install

# 重启服务
echo ""
echo "重启服务..."

if [ "$PM2_RUNNING" = true ]; then
    pm2 reload mp3-hosting --update-env
    echo ""
    echo "========================================="
    echo "  升级完成！"
    echo "========================================="
    echo ""
    echo "服务已无感重启"
    echo "备份位置: $BACKUP_DIR"
    echo ""
    pm2 status
else
    echo ""
    echo "========================================="
    echo "  升级完成！"
    echo "========================================="
    echo ""
    echo "请手动重启服务:"
    echo "  后台运行: pm2 start server.js --name mp3-hosting"
    echo "  前台运行: node server.js"
    echo ""
    echo "备份位置: $BACKUP_DIR"
fi

echo ""
echo "升级说明:"
echo "- 配置文件已保留"
echo "- 上传的文件已保留"
echo "- 如遇问题，可从 $BACKUP_DIR 恢复"
echo ""






