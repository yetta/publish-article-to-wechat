import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class ObsidianReader {
    constructor(notesPath) {
        this.notesPath = notesPath;
    }

    /**
     * 获取今日日期字符串 (YYYY-MM-DD)
     */
    getTodayDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 获取昨日日期字符串 (YYYY-MM-DD)
     */
    getYesterdayDateString() {
        const now = new Date();
        now.setDate(now.getDate() - 1);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 查找包含指定日期的笔记文件
     * @param {string} dateStr - 日期字符串，格式 YYYY-MM-DD
     * @returns {string|null} - 笔记文件路径，未找到返回 null
     */
    findNoteByDate(dateStr) {
        if (!fs.existsSync(this.notesPath)) {
            logger.error(`笔记目录不存在: ${this.notesPath}`);
            return null;
        }

        const files = fs.readdirSync(this.notesPath);
        const mdFiles = files.filter(f => f.endsWith('.md') && f.includes(dateStr));

        if (mdFiles.length === 0) {
            logger.info(`未找到日期 ${dateStr} 的笔记`);
            return null;
        }

        // 如果有多篇，选取第一篇
        const selectedFile = mdFiles[0];
        logger.info(`找到笔记: ${selectedFile}`);

        return path.join(this.notesPath, selectedFile);
    }

    /**
     * 查找今日笔记
     * @returns {string|null}
     */
    findTodayNote() {
        const todayStr = this.getTodayDateString();
        logger.info(`查找日期 ${todayStr} 的笔记...`);
        return this.findNoteByDate(todayStr);
    }

    /**
     * 查找昨日笔记
     * @returns {string|null}
     */
    findYesterdayNote() {
        const yesterdayStr = this.getYesterdayDateString();
        logger.info(`查找日期 ${yesterdayStr} 的笔记...`);
        return this.findNoteByDate(yesterdayStr);
    }

    /**
     * 查找包含指定日期的所有笔记文件
     * @param {string} dateStr - 日期字符串,格式 YYYY-MM-DD
     * @returns {string[]} - 笔记文件路径数组
     */
    findAllNotesByDate(dateStr) {
        if (!fs.existsSync(this.notesPath)) {
            logger.error(`笔记目录不存在: ${this.notesPath}`);
            return [];
        }

        const files = fs.readdirSync(this.notesPath);
        const mdFiles = files.filter(f => f.endsWith('.md') && f.includes(dateStr));

        if (mdFiles.length === 0) {
            logger.info(`未找到日期 ${dateStr} 的笔记`);
            return [];
        }

        logger.info(`找到 ${mdFiles.length} 条日期 ${dateStr} 的笔记`);
        return mdFiles.map(f => path.join(this.notesPath, f));
    }

    /**
     * 查找昨日所有笔记
     * @returns {string[]}
     */
    findAllYesterdayNotes() {
        const yesterdayStr = this.getYesterdayDateString();
        logger.info(`查找日期 ${yesterdayStr} 的所有笔记...`);
        return this.findAllNotesByDate(yesterdayStr);
    }

    /**
     * 解析笔记内容
     * @param {string} filePath - 笔记文件路径
     * @param {boolean} extractKeyPointsOnly - 是否只提取摘要和核心要点
     * @returns {object} - { title, content, images, digest }
     */
    parseNote(filePath, extractKeyPointsOnly = false) {
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const lines = rawContent.split('\n');

        // 提取标题 (第一个 # 开头的行)
        let title = '';
        let contentStartIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('# ')) {
                title = line.replace(/^#\s*/, '').trim();
                contentStartIndex = i + 1;
                break;
            }
        }

        // 如果没有找到标题，使用文件名
        if (!title) {
            title = path.basename(filePath, '.md');
        }

        // 提取内容 (标题之后的所有内容)
        let content = lines.slice(contentStartIndex).join('\n').trim();

        // 如果只提取核心要点
        if (extractKeyPointsOnly) {
            content = this.extractKeyContent(content);
        }

        // 提取图片引用
        const images = this.extractImages(rawContent, filePath);

        // 提取摘要 (查找 > 开头的引用块，或取前200字符)
        let digest = '';
        const digestMatch = content.match(/^>\s*(.+)/m);
        if (digestMatch) {
            digest = digestMatch[1].replace(/[📅📝🔑🔗]/g, '').trim();
        }
        if (!digest || digest.length < 10) {
            // 取正文前200字符作为摘要
            const plainText = content.replace(/[#*>\[\]()!`]/g, '').replace(/\n+/g, ' ');
            digest = plainText.substring(0, 200).trim();
        }

        logger.info(`解析笔记完成: 标题="${title}", 图片数量=${images.length}`);

        return {
            title,
            content,
            images,
            digest,
            rawContent
        };
    }

    /**
     * 提取笔记中的图片引用
     * @param {string} content - Markdown 内容
     * @param {string} notePath - 笔记文件路径
     * @returns {Array<{markdown: string, localPath: string}>}
     */
    extractImages(content, notePath) {
        const images = [];
        const noteDir = path.dirname(notePath);

        // 匹配 Markdown 图片语法: ![alt](path) 或 ![[path]]
        const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const wikiImageRegex = /!\[\[([^\]]+)\]\]/g;

        let match;

        // 标准 Markdown 图片
        while ((match = mdImageRegex.exec(content)) !== null) {
            const imagePath = match[2];
            const localPath = this.resolveImagePath(imagePath, noteDir);
            if (localPath && fs.existsSync(localPath)) {
                images.push({
                    markdown: match[0],
                    localPath,
                    alt: match[1]
                });
            }
        }

        // Obsidian Wiki 链接图片
        while ((match = wikiImageRegex.exec(content)) !== null) {
            const imagePath = match[1];
            const localPath = this.resolveImagePath(imagePath, noteDir);
            if (localPath && fs.existsSync(localPath)) {
                images.push({
                    markdown: match[0],
                    localPath,
                    alt: ''
                });
            }
        }

        return images;
    }

    /**
     * 解析图片相对路径为绝对路径
     * @param {string} imagePath - 图片路径
     * @param {string} noteDir - 笔记所在目录
     * @returns {string|null}
     */
    resolveImagePath(imagePath, noteDir) {
        // 跳过网络图片
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return null;
        }

        // 处理相对路径
        if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
            return path.resolve(noteDir, imagePath);
        }

        // 尝试 attachments 子目录
        const attachmentsPath = path.join(noteDir, 'attachments', imagePath);
        if (fs.existsSync(attachmentsPath)) {
            return attachmentsPath;
        }

        // 尝试直接在笔记目录下
        const directPath = path.join(noteDir, imagePath);
        if (fs.existsSync(directPath)) {
            return directPath;
        }

        return null;
    }

    /**
     * 获取第一张图片作为封面图
     * @param {Array} images - 图片数组
     * @returns {string|null}
     */
    getCoverImage(images) {
        if (images.length > 0) {
            return images[0].localPath;
        }
        return null;
    }

    /**
     * 提取核心内容(只保留摘要和核心要点)
     * @param {string} content - 完整内容
     * @returns {string} - 过滤后的内容
     */
    extractKeyContent(content) {
        const lines = content.split('\n');
        const result = [];
        let inKeySection = false;
        let skipSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // 检测章节标题
            if (trimmed.startsWith('##')) {
                const sectionTitle = trimmed.toLowerCase();

                // 需要保留的章节
                if (sectionTitle.includes('摘要') ||
                    sectionTitle.includes('summary') ||
                    sectionTitle.includes('要点') ||
                    sectionTitle.includes('核心') ||
                    sectionTitle.includes('key')) {
                    inKeySection = true;
                    skipSection = false;
                    result.push(line);
                }
                // 需要跳过的章节
                else if (sectionTitle.includes('链接') ||
                    sectionTitle.includes('link') ||
                    sectionTitle.includes('工具') ||
                    sectionTitle.includes('tool') ||
                    sectionTitle.includes('产品') ||
                    sectionTitle.includes('product') ||
                    sectionTitle.includes('资源') ||
                    sectionTitle.includes('resource')) {
                    inKeySection = false;
                    skipSection = true;
                }
                // 其他章节
                else {
                    inKeySection = false;
                    skipSection = false;
                    result.push(line);
                }
            }
            // 如果在需要保留的章节中,或者不在跳过的章节中
            else if (inKeySection || !skipSection) {
                result.push(line);
            }
        }

        return result.join('\n').trim();
    }

    /**
     * 合并多条笔记
     * @param {string[]} notePaths - 笔记文件路径数组
     * @param {boolean} extractKeyPointsOnly - 是否只提取核心要点
     * @returns {object} - 合并后的笔记对象
     */
    mergeNotes(notePaths, extractKeyPointsOnly = false) {
        if (notePaths.length === 0) {
            return null;
        }

        if (notePaths.length === 1) {
            return this.parseNote(notePaths[0], extractKeyPointsOnly);
        }

        logger.info(`合并 ${notePaths.length} 条笔记...`);

        const notes = notePaths.map(path => this.parseNote(path, extractKeyPointsOnly));

        // 合并标题
        const mergedTitle = `AI 资讯汇总 ${this.getYesterdayDateString()}`;

        // 合并内容
        const mergedContent = notes.map((note, index) => {
            return `## ${note.title}\n\n${note.content}`;
        }).join('\n\n---\n\n');

        // 合并图片
        const mergedImages = notes.flatMap(n => n.images);

        // 合并摘要
        const mergedDigest = notes.map(n => n.digest).join(' ');

        return {
            title: mergedTitle,
            content: mergedContent,
            images: mergedImages,
            digest: mergedDigest.substring(0, 200),
            rawContent: mergedContent
        };
    }
}

export default ObsidianReader;
