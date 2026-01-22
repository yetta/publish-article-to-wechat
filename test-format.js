import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ObsidianReader from './src/obsidian-reader.js';
import MarkdownConverter from './src/markdown-converter.js';
import logger from './src/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notesPath = process.env.OBSIDIAN_NOTES_PATH;
const reader = new ObsidianReader(notesPath);
const converter = new MarkdownConverter();

// 使用 1 月 17 日的笔记测试
const notePath = reader.findNoteByDate('2026-01-17');
if (notePath) {
    const note = reader.parseNote(notePath);
    note.title = converter.cleanTitle(note.title);

    // 模拟无图片
    const imageUrlMap = new Map();

    const articleHtml = converter.generateArticleHtml(note, imageUrlMap);

    // 保存测试草稿
    const draftPath = path.join(__dirname, 'draft', 'draft_test.html');
    const fullHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${note.title}</title></head><body>${articleHtml}</body></html>`;
    fs.writeFileSync(draftPath, fullHtml, 'utf-8');

    logger.success('测试草稿已保存: ' + draftPath);
}
