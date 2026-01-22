import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, '..');

// 配置
const LABEL = 'com.xuye.publish-to-wechat'; // 唯一的服务标识符
const SCRIPT_PATH = path.join(PROJECT_DIR, 'scripts', 'run-publish.sh');
const DEFAULT_HOUR = 7;
const DEFAULT_MINUTE = 0;

// 获取用户主目录
const HOME_DIR = process.env.HOME;
const PLIST_DIR = path.join(HOME_DIR, 'Library', 'LaunchAgents');
const PLIST_PATH = path.join(PLIST_DIR, `${LABEL}.plist`);

function generatePlist(hour, minute) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_PATH}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>${hour}</integer>
        <key>Minute</key>
        <integer>${minute}</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/logs/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/logs/launchd.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>`;
}

async function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function main() {
    console.log('========== 设置微信公众号自动发布任务 ==========');
    console.log(`项目路径: ${PROJECT_DIR}`);
    console.log(`执行脚本: ${SCRIPT_PATH}`);

    // 检查 scripts/run-publish.sh 是否存在且可执行
    if (!fs.existsSync(SCRIPT_PATH)) {
        console.error('❌ 错误: scripts/run-publish.sh 不存在');
        process.exit(1);
    }

    // 询问执行时间
    const timeStr = await askQuestion(`请输入每天执行时间 (格式 HH:MM，默认 ${DEFAULT_HOUR.toString().padStart(2, '0')}:${DEFAULT_MINUTE.toString().padStart(2, '0')}): `);

    let hour = DEFAULT_HOUR;
    let minute = DEFAULT_MINUTE;

    if (timeStr.trim()) {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            hour = parseInt(parts[0], 10);
            minute = parseInt(parts[1], 10);
        } else {
            console.warn('⚠️ 时间格式不正确，将使用默认时间。');
        }
    }

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        console.error('❌ 时间无效。');
        process.exit(1);
    }

    console.log(`✅ 设定时间: 每天 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);

    // 生成 plist 内容
    const plistContent = generatePlist(hour, minute);

    // 确保 LaunchAgents 目录存在
    if (!fs.existsSync(PLIST_DIR)) {
        fs.mkdirSync(PLIST_DIR, { recursive: true });
    }

    // 写入 plist 文件
    fs.writeFileSync(PLIST_PATH, plistContent);
    console.log(`✅ 配置文件已生成: ${PLIST_PATH}`);

    // 卸载旧任务 (如果存在)
    try {
        execSync(`launchctl bootout gui/${process.getuid()} ${PLIST_PATH}`, { stdio: 'ignore' });
        console.log('🔄 已卸载旧任务');
    } catch (e) {
        // 忽略错误，可能之前没有加载
    }

    // 加载新任务
    try {
        execSync(`launchctl bootstrap gui/${process.getuid()} ${PLIST_PATH}`);
        console.log('🚀 任务已成功加载到 launchd');
        console.log('ℹ️  你可以使用 "install-schedule" 再次运行此脚本来更新时间。');
        console.log('ℹ️  运行 "launchctl list | grep com.xuye" 可以检查任务状态。');
    } catch (e) {
        console.error('❌ 加载任务失败:', e.message);
        process.exit(1);
    }
}

main().catch(console.error);
