# 📤 Publish Article to WeChat

自动将 Obsidian 笔记转换为微信公众号草稿的自动化工具。

## ✨ 功能特点

- **自动查找**：根据日期自动定位 Obsidian 中的笔记（默认为**昨日**的笔记）。
- **格式转换**：将 Markdown 转换为微信公众号兼容的 HTML，并在本地生成预览。
- **图片处理**：自动提取笔记中的图片（包括本地附件），上传至微信素材库并替换链接。
- **排版优化**：内置 CSS 样式，确保在微信中显示美观。
- **自动发布**：直接生成公众号草稿，附带摘要和封面图。
- **定时运行**：支持通过 macOS Launchd 设置每日自动化任务。

## 🛠️ 安装与配置

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   复制 `.env.example` 为 `.env` 并填入以下信息：
   ```env
   # 微信公众号配置 (在公众号后台 -> 基本配置 获取)
   WECHAT_APP_ID=your_app_id
   WECHAT_APP_SECRET=your_app_secret
   
   # 公众号名称 (作为作者名)
   WECHAT_ACCOUNT_NAME=硅基Daily

   # Obsidian 笔记库绝对路径
   OBSIDIAN_NOTES_PATH=/Users/your_name/Documents/ObsidianVault/News
   ```

## 🚀 使用方法

### 手动运行
立即执行一次发布任务：
```bash
npm start
```
*脚本会查找文件名包含昨日日期（格式：YYYY-MM-DD）的笔记进行处理。*

### ⏰ 设置定时任务
通过 macOS 系统服务设置每天自动运行（默认 07:00）：
```bash
npm run setup-schedule
```
按照提示输入执行时间即可。

- **查看日志**：`logs/launchd.log`
- **更新时间**：再次运行 `npm run setup-schedule`
- **检查状态**：`launchctl list | grep com.xuye`

## 📂 项目结构

- `src/`
  - `obsidian-reader.js`: 读取和解析笔记内容
  - `markdown-converter.js`: Markdown 转 HTML 及样式处理
  - `wechat-api.js`: 微信 API 交互（Token、图片上传、草稿新建）
- `scripts/`
  - `setup-schedule.js`: 定时任务配置脚本
  - `run-publish.sh`: 定时任务执行入口
- `draft/`: 存放生成的本地 HTML 预览文件
- `logs/`: 运行日志

## ⚠️ 注意事项

- **图片上传**：仅支持本地图片，微信接口对上传图片大小和格式有限制。
- **封面图**：默认使用笔记中的第一张图片作为封面。若无图片，可能无法成功创建草稿（需手动上传封面）。
- **链接限制**：微信订阅号在查看时会屏蔽外部链接点击（显示为文本）。
