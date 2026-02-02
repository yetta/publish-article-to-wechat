import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ObsidianReader from '../src/obsidian-reader.js';
import MarkdownConverter from '../src/markdown-converter.js';
import WechatAPI from '../src/wechat-api.js';
import logger from '../src/logger.js';

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
function saveDraftLocally(html, title, dateStr, index) {
    const draftDir = path.join(path.dirname(__dirname), 'draft');
    ensureDir(draftDir);

    const fileName = `draft_${dateStr}_${index}.html`;
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
 * 发布指定日期的笔记
 */
async function publishNotesByDate(targetDate) {
    try {
        if (!targetDate) {
            throw new Error('请提供目标日期，格式为 YYYY-MM-DD');
        }

        logger.info(`========== 开始发布 ${targetDate} 的笔记 ==========`);

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

        // 查找指定日期的所有笔记
        const notePaths = reader.findAllNotesByDate(targetDate);
        if (notePaths.length === 0) {
            logger.warn(`未找到 ${targetDate} 的笔记, 跳过发布`);
            return { success: false, reason: 'no_note' };
        }

        logger.info(`找到 ${notePaths.length} 条 ${targetDate} 的笔记`);

        // 记录发布结果
        const results = [];

        // 循环处理每篇笔记
        for (let i = 0; i < notePaths.length; i++) {
            const notePath = notePaths[i];
            logger.info(`\n处理笔记 ${i + 1}/${notePaths.length}: ${path.basename(notePath)}`);

            try {
                // 解析单篇笔记
                const note = reader.parseNote(notePath, true);

                // 清理标题
                const cleanedTitle = converter.cleanTitle(note.title);
                note.title = cleanedTitle;
                logger.info(`准备发布笔记: ${note.title}`);

                // 上传图片并获取 URL 映射
                const imageUrlMap = new Map();
                let thumbMediaId = null;

                for (let j = 0; j < note.images.length; j++) {
                    const image = note.images[j];
                    try {
                        if (j === 0) {
                            const thumbResult = await wechatApi.uploadMaterial(image.localPath, 'image');
                            thumbMediaId = thumbResult.media_id;
                            logger.info(`封面图上传成功: ${thumbMediaId}`);
                        }
                        const imageUrl = await wechatApi.uploadContentImage(image.localPath);
                        imageUrlMap.set(image.localPath, imageUrl);
                    } catch (error) {
                        logger.warn(`图片上传失败，跳过: ${image.localPath}`);
                    }
                }

                // 转换 HTML
                const articleHtml = converter.generateArticleHtml(note, imageUrlMap);

                // 保存本地备份
                saveDraftLocally(articleHtml, note.title, targetDate, i + 1);

                // 创建微信草稿
                if (thumbMediaId) {
                    const result = await wechatApi.createDraft({
                        title: note.title,
                        content: articleHtml,
                        digest: note.digest.substring(0, 120),
                        thumbMediaId: thumbMediaId,
                        author: accountName
                    });

                    logger.success(`✓ 草稿 ${i + 1} 发布成功! media_id: ${result.media_id}`);
                    results.push({ success: true, mediaId: result.media_id, title: note.title });
                } else {
                    logger.warn(`草稿 ${i + 1} 缺少封面图，仅保存到本地`);
                    results.push({ success: false, reason: 'no_cover', title: note.title });
                }

            } catch (error) {
                logger.error(`处理笔记 ${i + 1} 失败`, error);
                results.push({ success: false, reason: 'error', error: error.message, title: path.basename(notePath) });
            }
        }

        return {
            success: results.some(r => r.success),
            results
        };

    } catch (error) {
        logger.error('发布笔记时发生错误', error);
        throw error;
    }
}

// 获取命令行参数
const targetDate = process.argv[2];
if (!targetDate) {
    console.error('用法: node scripts/publish-specific-date.js YYYY-MM-DD');
    process.exit(1);
}

publishNotesByDate(targetDate)
    .then(result => {
        if (result.success) {
            logger.success(`\n任务完成！`);
        } else {
            logger.warn(`\n任务结束: ${result.reason || '未成功发布任何笔记'}`);
        }
        process.exit(0);
    })
    .catch(error => {
        logger.error('任务失败', error);
        process.exit(1);
    });
