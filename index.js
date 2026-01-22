import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ObsidianReader from './src/obsidian-reader.js';
import MarkdownConverter from './src/markdown-converter.js';
import WechatAPI from './src/wechat-api.js';
import logger from './src/logger.js';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * 保存草稿到本地
 */
function saveDraftLocally(html, title) {
    const draftDir = path.join(__dirname, 'draft');
    ensureDir(draftDir);

    const today = new Date().toISOString().split('T')[0];
    const fileName = `draft_${today}.html`;
    const filePath = path.join(draftDir, fileName);

    // 生成完整的 HTML 文件
    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${html}
</body>
</html>
    `.trim();

    fs.writeFileSync(filePath, fullHtml, 'utf-8');
    logger.info(`草稿已保存到本地: ${filePath}`);
    return filePath;
}

/**
 * 发布今日笔记到微信公众号草稿箱
 */
async function publishTodayNote() {
    try {
        logger.info('========== 开始发布笔记 ==========');

        // 读取配置
        const appId = process.env.WECHAT_APP_ID;
        const appSecret = process.env.WECHAT_APP_SECRET;
        const notesPath = process.env.OBSIDIAN_NOTES_PATH;
        const accountName = process.env.WECHAT_ACCOUNT_NAME || '硅基Daily';

        // 验证配置
        if (!appId || !appSecret) {
            throw new Error('请在 .env 文件中配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
        }
        if (!notesPath) {
            throw new Error('请在 .env 文件中配置 OBSIDIAN_NOTES_PATH');
        }

        // 初始化服务
        const reader = new ObsidianReader(notesPath);
        const converter = new MarkdownConverter();
        const wechatApi = new WechatAPI(appId, appSecret);

        // 查找昨日笔记
        const notePath = reader.findYesterdayNote();
        if (!notePath) {
            logger.warn('未找到昨日笔记，跳过发布');
            return { success: false, reason: 'no_note' };
        }

        // 解析笔记
        const note = reader.parseNote(notePath);

        // 清理标题，移除微信公众号不支持的特殊符号
        const cleanedTitle = converter.cleanTitle(note.title);
        logger.info(`原标题: ${note.title}`);
        logger.info(`清理后标题: ${cleanedTitle}`);
        note.title = cleanedTitle;

        logger.info(`准备发布笔记: ${note.title}`);

        // 上传图片并获取 URL 映射
        const imageUrlMap = new Map();
        let thumbMediaId = null;

        for (let i = 0; i < note.images.length; i++) {
            const image = note.images[i];
            try {
                // 第一张图片同时作为封面图
                if (i === 0) {
                    const thumbResult = await wechatApi.uploadMaterial(image.localPath, 'image');
                    thumbMediaId = thumbResult.media_id;
                    logger.info(`封面图上传成功: ${thumbResult.media_id}`);
                }

                // 上传正文图片
                const imageUrl = await wechatApi.uploadContentImage(image.localPath);
                imageUrlMap.set(image.localPath, imageUrl);
            } catch (error) {
                logger.warn(`图片上传失败，跳过: ${image.localPath}`);
            }
        }

        // 如果没有封面图，需要提供一个默认的
        if (!thumbMediaId && note.images.length === 0) {
            logger.warn('笔记没有图片，将使用无封面模式（可能需要手动添加封面）');
            // 微信要求必须有封面图，这里先跳过
            // 实际使用时建议准备一个默认封面图
        }

        // 转换 Markdown 为微信 HTML
        const articleHtml = converter.generateArticleHtml(note, imageUrlMap);

        // 保存草稿到本地
        saveDraftLocally(articleHtml, note.title);

        // 创建微信草稿
        if (thumbMediaId) {
            const result = await wechatApi.createDraft({
                title: note.title,
                content: articleHtml,
                digest: note.digest.substring(0, 120), // 微信摘要限制 120 字
                thumbMediaId: thumbMediaId,
                author: accountName
            });

            logger.success(`✓ 草稿发布成功! media_id: ${result.media_id}`);
            return { success: true, mediaId: result.media_id };
        } else {
            logger.warn('缺少封面图，仅保存到本地，未发布到微信');
            return { success: false, reason: 'no_cover' };
        }

    } catch (error) {
        logger.error('发布笔记时发生错误', error);
        throw error;
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    publishTodayNote()
        .then(result => {
            if (result.success) {
                logger.success(`\n任务完成！草稿已发布到微信公众号`);
            } else {
                logger.warn(`\n任务结束: ${result.reason}`);
            }
            process.exit(0);
        })
        .catch(error => {
            logger.error('任务失败', error);
            process.exit(1);
        });
}

export default publishTodayNote;
