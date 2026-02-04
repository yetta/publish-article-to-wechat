#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ObsidianReader from '../src/obsidian-reader.js';
import MarkdownConverter from '../src/markdown-converter.js';
import WechatAPI from '../src/wechat-api.js';
import logger from '../src/logger.js';

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
function saveDraftLocally(html, title, fileName = null) {
    const draftDir = path.join(__dirname, '../draft');
    ensureDir(draftDir);

    if (!fileName) {
        const today = new Date().toISOString().split('T')[0];
        fileName = `draft_${today}_republish.html`;
    }
    const filePath = path.join(draftDir, fileName);

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
 * 重新发布指定的笔记
 */
async function republishNote(notePath) {
    try {
        logger.info('========== 开始重新发布笔记 ==========');

        // 读取配置
        const appId = process.env.WECHAT_APP_ID;
        const appSecret = process.env.WECHAT_APP_SECRET;
        const accountName = process.env.WECHAT_ACCOUNT_NAME || '硅基Daily';

        // 验证配置
        if (!appId || !appSecret) {
            throw new Error('请在 .env 文件中配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
        }

        // 初始化服务
        const reader = new ObsidianReader(path.dirname(notePath));
        const converter = new MarkdownConverter();
        const wechatApi = new WechatAPI(appId, appSecret);

        // 解析笔记 - 不使用 extractKeyPointsOnly,保留完整内容
        const note = reader.parseNote(notePath, false);

        // 清理标题
        const cleanedTitle = converter.cleanTitle(note.title);
        logger.info(`原标题: ${note.title}`);
        logger.info(`清理后标题: ${cleanedTitle}`);
        note.title = cleanedTitle;

        logger.info(`准备发布笔记: ${note.title}`);

        // 上传图片并获取 URL 映射
        const imageUrlMap = new Map();
        let thumbMediaId = null;

        for (let j = 0; j < note.images.length; j++) {
            const image = note.images[j];
            try {
                // 第一张图片同时作为封面图
                if (j === 0) {
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

        // 转换 Markdown 为微信 HTML
        const articleHtml = converter.generateArticleHtml(note, imageUrlMap);

        // 保存草稿到本地
        const today = new Date().toISOString().split('T')[0];
        const fileName = `draft_${today}_republish.html`;
        saveDraftLocally(articleHtml, note.title, fileName);

        // 创建微信草稿
        if (thumbMediaId) {
            const result = await wechatApi.createDraft({
                title: note.title,
                content: articleHtml,
                digest: note.digest.substring(0, 120),
                thumbMediaId: thumbMediaId,
                author: accountName
            });

            logger.success(`✓ 草稿发布成功! media_id: ${result.media_id}`);
            return { success: true, mediaId: result.media_id, title: note.title };
        } else {
            logger.warn(`缺少封面图，仅保存到本地`);
            return { success: false, reason: 'no_cover', title: note.title };
        }

    } catch (error) {
        logger.error('重新发布笔记时发生错误', error);
        throw error;
    }
}

// 主程序
const notePath = process.argv[2];
if (!notePath) {
    console.error('用法: node republish-single-note.js <笔记文件路径>');
    process.exit(1);
}

if (!fs.existsSync(notePath)) {
    console.error(`文件不存在: ${notePath}`);
    process.exit(1);
}

republishNote(notePath)
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
