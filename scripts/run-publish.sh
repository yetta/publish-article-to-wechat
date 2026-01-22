#!/bin/bash

# 获取脚本所在目录的上一级目录（项目根目录）
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 设置日志目录
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

# 获取当前日期
DATE=$(date +%Y-%m-%d)

# 确保 Node.js 在 PATH 中
# 尝试加载用户的 shell 配置
if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

# 如果 source 之后还没找到 node，尝试常见的 node 安装路径
if ! command -v node &> /dev/null; then
    export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin
fi

# 记录开始时间
echo "[$DATE $(date +%H:%M:%S)] Starting scheduled publish task..." >> "$LOG_DIR/launchd.log"

# 进入项目目录
cd "$PROJECT_DIR"

# 执行 npm start
# 将标准输出追加到 launchd.log，标准错误追加到 launchd.err
npm run start >> "$LOG_DIR/launchd.log" 2>> "$LOG_DIR/launchd.err"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$DATE $(date +%H:%M:%S)] Task completed successfully." >> "$LOG_DIR/launchd.log"
else
    echo "[$DATE $(date +%H:%M:%S)] Task failed with exit code $EXIT_CODE. Check launchd.err for details." >> "$LOG_DIR/launchd.log"
fi
