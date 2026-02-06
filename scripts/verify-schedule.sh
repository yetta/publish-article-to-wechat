#!/bin/bash

# 验证定时任务是否正常执行的脚本
# 使用方法: ./scripts/verify-schedule.sh

echo "========== 定时任务状态检查 =========="
echo ""

# 1. 检查服务是否加载
echo "1. 检查服务加载状态:"
launchctl list | grep com.xuye.publish-to-wechat
if [ $? -eq 0 ]; then
    echo "   ✅ 服务已加载"
else
    echo "   ❌ 服务未加载"
    exit 1
fi
echo ""

# 2. 检查服务详细信息
echo "2. 检查服务详细信息:"
SERVICE_INFO=$(launchctl print gui/$(id -u)/com.xuye.publish-to-wechat 2>&1)
if echo "$SERVICE_INFO" | grep -q "Could not find service"; then
    echo "   ❌ 无法获取服务信息"
    exit 1
else
    echo "   ✅ 服务信息正常"
    echo ""
    echo "   状态信息:"
    echo "$SERVICE_INFO" | grep -E "(state|runs|last exit)" | sed 's/^/   /'
fi
echo ""

# 3. 检查 plist 文件
echo "3. 检查 plist 文件:"
plutil -lint ~/Library/LaunchAgents/com.xuye.publish-to-wechat.plist > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ plist 文件格式正确"
else
    echo "   ❌ plist 文件格式错误"
    exit 1
fi
echo ""

# 4. 检查定时配置
echo "4. 检查定时配置:"
HOUR=$(cat ~/Library/LaunchAgents/com.xuye.publish-to-wechat.plist | grep -A 1 "<key>Hour</key>" | grep "<integer>" | sed 's/.*<integer>\(.*\)<\/integer>.*/\1/')
MINUTE=$(cat ~/Library/LaunchAgents/com.xuye.publish-to-wechat.plist | grep -A 1 "<key>Minute</key>" | grep "<integer>" | sed 's/.*<integer>\(.*\)<\/integer>.*/\1/')
echo "   执行时间: 每天 ${HOUR}:$(printf "%02d" $MINUTE)"
echo ""

# 5. 检查最新日志
echo "5. 检查最新日志:"
LAUNCHD_LOG="logs/launchd.log"
if [ -f "$LAUNCHD_LOG" ]; then
    LAST_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$LAUNCHD_LOG")
    echo "   最后修改时间: $LAST_MODIFIED"
else
    echo "   ⚠️  launchd.log 文件不存在"
fi

# 查找最新的应用日志
LATEST_LOG=$(ls -t logs/*.log 2>/dev/null | grep -v launchd.log | head -1)
if [ -n "$LATEST_LOG" ]; then
    echo "   最新应用日志: $(basename $LATEST_LOG)"
else
    echo "   ⚠️  未找到应用日志"
fi
echo ""

# 6. 检查今天是否有待发布笔记
echo "6. 检查待发布笔记:"
NOTES_PATH=$(grep OBSIDIAN_NOTES_PATH .env | cut -d'=' -f2)
YESTERDAY=$(date -v-1d +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)

echo "   昨天日期: $YESTERDAY"
YESTERDAY_NOTES=$(ls "$NOTES_PATH" 2>/dev/null | grep "$YESTERDAY" | wc -l | xargs)
echo "   昨天笔记数量: $YESTERDAY_NOTES"

if [ "$YESTERDAY_NOTES" -gt 0 ]; then
    echo "   📝 待发布笔记:"
    ls "$NOTES_PATH" 2>/dev/null | grep "$YESTERDAY" | sed 's/^/      - /'
fi
echo ""

# 7. 总结
echo "========== 检查完成 =========="
echo ""
echo "下次执行时间: 明天 ${HOUR}:$(printf "%02d" $MINUTE)"
echo ""
echo "验证方法:"
echo "  1. 明天 ${HOUR}:$(printf "%02d" $MINUTE) 后检查 logs/launchd.log"
echo "  2. 运行此脚本查看服务状态"
echo "  3. 检查微信公众号草稿箱"
