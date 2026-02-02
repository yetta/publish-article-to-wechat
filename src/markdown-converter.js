import { marked } from 'marked';
import logger from './logger.js';

class MarkdownConverter {
    constructor() {
        // 配置 marked
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    /**
     * 将 Markdown 转换为微信公众号兼容的 HTML
     * @param {string} markdown - Markdown 内容
     * @param {Map<string, string>} imageUrlMap - 图片映射表 {localPath: wechatUrl}
     * @returns {string} - HTML 内容
     */
    convert(markdown, imageUrlMap = new Map()) {
        // 预处理 Markdown，修复格式问题
        let processedMarkdown = this.preprocessMarkdown(markdown);

        for (const [localPath, wechatUrl] of imageUrlMap) {
            // 替换标准 Markdown 图片
            const mdRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^)]*${this.escapeRegex(localPath.split('/').pop())}[^)]*\\)`, 'g');
            processedMarkdown = processedMarkdown.replace(mdRegex, `![$1](${wechatUrl})`);

            // 替换 Obsidian Wiki 链接图片
            const wikiRegex = new RegExp(`!\\[\\[[^\\]]*${this.escapeRegex(localPath.split('/').pop())}[^\\]]*\\]\\]`, 'g');
            processedMarkdown = processedMarkdown.replace(wikiRegex, `![](${wechatUrl})`);
        }

        // 转换为 HTML
        let html = marked.parse(processedMarkdown);

        // 应用微信公众号样式
        html = this.applyWechatStyles(html);

        return html;
    }

    /**
     * 应用微信公众号内联样式
     * @param {string} html - 原始 HTML
     * @returns {string} - 带样式的 HTML
     */
    applyWechatStyles(html) {
        // 先清理 HTML 中的多余空白和换行（避免 justify 时产生异常间距）
        let result = html;

        // 移除标签之间的空白
        result = result.replace(/>\s+</g, '><');

        // 移除标签内文本前后的多余空白
        result = result.replace(/>\s+/g, '>');
        result = result.replace(/\s+</g, '<');

        // 标题样式 - 使用更保守的样式
        result = result.replace(/<h1>/g, '<h1 style="font-size: 20px; font-weight: bold; color: #333; margin: 16px 0 12px 0; line-height: 1.5;">');
        result = result.replace(/<h2>/g, '<h2 style="font-size: 17px; font-weight: bold; color: #333; margin: 16px 0 10px 0; line-height: 1.5; border-bottom: 1px solid #eee; padding-bottom: 6px;">');
        result = result.replace(/<h3>/g, '<h3 style="font-size: 15px; font-weight: bold; color: #333; margin: 14px 0 8px 0; line-height: 1.5;">');
        result = result.replace(/<h4>/g, '<h4 style="font-size: 14px; font-weight: bold; color: #333; margin: 12px 0 6px 0; line-height: 1.5;">');

        // 段落样式 - 移除 justify，使用 left 对齐避免间距问题
        result = result.replace(/<p>/g, '<p style="font-size: 14px; color: #333; line-height: 1.75; margin: 10px 0; text-align: left; word-break: break-word;">');

        // 列表样式 - 简化样式，避免对齐问题
        result = result.replace(/<ul>/g, '<ul style="margin: 10px 0; padding-left: 2em; list-style-type: disc;">');
        result = result.replace(/<ol>/g, '<ol style="margin: 10px 0; padding-left: 2em; list-style-type: decimal;">');
        result = result.replace(/<li>/g, '<li style="font-size: 14px; color: #333; line-height: 1.75; margin: 6px 0; text-align: left;">');

        // 引用块样式
        result = result.replace(/<blockquote>/g, '<blockquote style="margin: 12px 0; padding: 10px 15px; background-color: #f7f7f7; border-left: 3px solid #ddd; color: #666; font-size: 14px; line-height: 1.6;">');

        // 代码块样式
        result = result.replace(/<pre>/g, '<pre style="margin: 12px 0; padding: 12px; background-color: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 13px;">');
        result = result.replace(/<code>/g, '<code style="font-family: Consolas, Monaco, monospace; font-size: 13px;">');

        // 图片样式
        result = result.replace(/<img /g, '<img style="max-width: 100%; height: auto; display: block; margin: 12px auto;" ');

        // 链接样式
        result = result.replace(/<a /g, '<a style="color: #576b95; text-decoration: none;" ');
        result = result.replace(/<a>/g, '<a style="color: #576b95; text-decoration: none;">');

        // 粗体样式
        result = result.replace(/<strong>/g, '<strong style="font-weight: bold; color: #333;">');

        // 分隔线样式
        result = result.replace(/<hr>/g, '<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">');
        result = result.replace(/<hr\/>/g, '<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">');

        // 表格样式
        result = result.replace(/<table>/g, '<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px;">');
        result = result.replace(/<th>/g, '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: left;">');
        result = result.replace(/<td>/g, '<td style="border: 1px solid #ddd; padding: 8px; text-align: left;">');

        // 最后清理：确保没有多余的属性
        result = result.replace(/<h1([^>]*style="[^"]*")([^>]*)>/g, '<h1$1>');
        result = result.replace(/<h2([^>]*style="[^"]*")([^>]*)>/g, '<h2$1>');
        result = result.replace(/<h3([^>]*style="[^"]*")([^>]*)>/g, '<h3$1>');
        result = result.replace(/<p([^>]*style="[^"]*")([^>]*)>/g, '<p$1>');

        // 移除外部链接和相关提示文字
        result = this.removeExternalLinks(result);

        return result;
    }

    /**
     * 移除外部链接和相关提示文字
     * @param {string} html - HTML 内容
     * @returns {string} - 处理后的 HTML
     */
    removeExternalLinks(html) {
        let result = html;

        // 移除独立的链接段落(整个段落只包含一个链接)
        // 匹配: <p><a>阅读更多</a></p> 或 <p><a>xxx</a>- 详细报道</p>
        const linkParagraphPatterns = [
            // 匹配只包含 "阅读更多" 链接的段落
            /<p[^>]*>\s*<a[^>]*>\s*(阅读更多|查看更多|了解更多|点击查看|查看详情)\s*<\/a>\s*<\/p>/gi,
            // 匹配包含链接和 "- 详细报道" 的段落
            /<p[^>]*>\s*<a[^>]*>[^<]+<\/a>\s*[-—]\s*(详细报道|更多信息|完整报道|深度报道)\s*<\/p>/gi,
            // 匹配只包含 "使用 xxx" 链接的段落
            /<p[^>]*>\s*<a[^>]*>\s*(使用|访问|体验|试用)[^<]*<\/a>\s*<\/p>/gi,
        ];

        linkParagraphPatterns.forEach(pattern => {
            result = result.replace(pattern, '');
        });

        // 移除列表项中的 "阅读更多" 链接(保留列表项,只移除链接)
        // 例如: <li>...内容...<a>阅读更多</a></li> -> <li>...内容...</li>
        result = result.replace(/<a[^>]*>\s*(阅读更多|查看更多|了解更多)\s*<\/a>/gi, '');

        // 移除所有剩余的 <a> 标签,保留链接文字
        // 例如: <a href="...">文字</a> -> 文字
        result = result.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');

        // 清理可能残留的 "- 详细报道" 等文字
        result = result.replace(/\s*[-—]\s*(详细报道|更多信息|完整报道|深度报道|阅读原文)\s*/gi, '');

        return result;
    }

    /**
     * 转义正则表达式特殊字符
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 预处理 Markdown 内容，修复格式问题
     * @param {string} markdown - 原始 Markdown
     * @returns {string} - 处理后的 Markdown
     */
    preprocessMarkdown(markdown) {
        let result = markdown;

        // 移除导致链接丢失的过度激进的修复逻辑
        // 原逻辑会尝试修复截断的链接，但可能误判正常链接
        // result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)(?:\n|$)/g, ...

        // 修复行尾没有正确闭合的 Markdown 链接
        result = result.replace(/\[([^\]]+)\]\(([^)\s]+)$/gm, (match, text, url) => {
            // 添加缺失的右括号
            return `[${text}](${url})`;
        });

        // 确保所有链接格式正确：处理特殊字符可能导致的问题
        // 移除链接 URL 中可能存在的换行符
        result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            const cleanUrl = url.replace(/\n/g, '').trim();
            return `[${text}](${cleanUrl})`;
        });

        return result;
    }

    /**
     * 清理标题，移除微信公众号不支持的特殊符号
     * @param {string} title - 原始标题
     * @returns {string} - 清理后的标题
     */
    cleanTitle(title) {
        let cleaned = title;

        // 移除 Emoji 表情符号
        cleaned = cleaned.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');

        // 移除常见特殊符号（保留中英文、数字、基本标点）
        // 微信公众号标题不允许的特殊字符
        cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。、；：''""（）【】《》！？·\-—,.;:'"()[\]!?]/g, '');

        // 清理多余空格
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    /**
     * 生成完整的微信公众号文章 HTML
     * @param {object} note - { title, content, digest }
     * @param {Map} imageUrlMap - 图片 URL 映射
     * @returns {string}
     */
    generateArticleHtml(note, imageUrlMap = new Map()) {
        const contentHtml = this.convert(note.content, imageUrlMap);

        // 添加文章包装 - 不使用缩进避免空白问题
        const html = `<section style="padding:15px;margin:0;background:#fff;">${contentHtml}</section><section style="padding:15px;margin-top:15px;background:#f7f7f7;text-align:center;font-size:12px;color:#999;"><p style="margin:5px 0;">— END —</p><p style="margin:8px 0;">关注「硅基Daily」，获取全球 AI 科技最新动态</p></section>`;

        return html;
    }
}

export default MarkdownConverter;
