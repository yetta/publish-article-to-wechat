# 微信公众号自动发布流程图 (手绘风格)

此流程图展示了 `publish-article-to-wechat` 项目的核心工作流程。
采用了 Mermaid 的手绘风格配置，在支持的渲染器（如 Obsidian v1.0.0+）中会呈现类似 Excalidraw 的效果。

```mermaid
%%{init: {
  'look': 'handDrawn', 
  'theme': 'neutral', 
  'themeVariables': { 
    'fontFamily': 'Virgil, Comic Sans MS', 
    'fontSize': '16px', 
    'lineColor': '#333'
  }
}}%%
flowchart TD
    %% --- 样式定义 ---
    classDef base fill:#fff,stroke:#333,stroke-width:2px;
    classDef startEnd fill:#ffecb3,stroke:#ff6f00,stroke-width:2px,color:#d84315;
    classDef process fill:#e1f5fe,stroke:#0277bd,stroke-width:2px;
    classDef decision fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef api fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,stroke-dasharray: 5 5;
    classDef highlight fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;

    %% --- 触发 ---
    Trigger((定时触发<br/>Launchd 07:00)):::base --> Start([启动任务]):::startEnd
    Manual((手动运行<br/>npm start)):::base --> Start

    %% --- 初始化 ---
    Start --> Init[加载配置 .env]:::process
    Init --> FindNote{查找昨日笔记?}:::decision
    
    FindNote -- 无 --> End([结束任务]):::startEnd
    FindNote -- 有 --> Parse[📖 解析 Markdown<br/>提取标题/正文/图片]:::process

    %% --- 图片处理 ---
    subgraph Image_Processing ["🖼️ 图片处理流程"]
        direction TB
        Parse --> UploadThumb["📤 上传封面图<br/>(第一张图片)"]:::api
        UploadThumb --> LoopImg{还有正文图片?}:::decision
        LoopImg -- 是 --> UploadBody["📤 上传正文图片<br/>获取微信 URL"]:::api
        UploadBody --> MapImg["🗺️ 建立映射<br/>本地路径 -> 微信 URL"]:::process
        MapImg --> LoopImg
    end
    
    LoopImg -- 否 --> Convert[✨ Markdown 转 HTML]:::process

    %% --- 转换与发布 ---
    subgraph Publish_Flow ["🚀 发布流程"]
        direction TB
        Convert --> ReplaceImg["🔄 替换图片链接<br/>Markdown -> 微信 HTML"]:::process
        ReplaceImg --> Style["🎨 应用公众号样式<br/>CSS 内联化"]:::process
        
        Style --> SaveLocal["💾 保存本地草稿<br/>draft/YYYY-MM-DD.html"]:::base
        SaveLocal --> CreateDraft["📝 调用微信 API<br/>新建草稿 (含摘要)"]:::api
    end

    CreateDraft --> Result{发布成功?}:::decision
    Result -- 是 --> Success[✅ 记录成功日志]:::highlight
    Result -- 否 --> Fail[❌ 记录错误日志]:::process
    
    Success --> End
    Fail --> End

    %% --- 样式调整 ---
    style Image_Processing fill:none,stroke:#666,stroke-width:2px,stroke-dasharray: 5 5
    style Publish_Flow fill:none,stroke:#333,stroke-width:2px
```

## 流程说明

1.  **触发**：支持每日定时任务（Launchd）或手动命令行触发。
2.  **查找**：`ObsidianReader` 自动查找**昨日**日期的 Markdown 笔记。
3.  **解析**：提取笔记内容，分离出图片引用。
4.  **图片处理**：
    *   将本地图片上传至微信素材库。
    *   第一张图片默认作为**封面图**。
    *   获取微信服务器的图片 URL。
5.  **转换**：`MarkdownConverter` 将 Markdown 转换为 HTML，并将本地图片路径替换为微信 URL，同时注入专用的 CSS 样式。
6.  **发布**：`WechatAPI` 将最终的 HTML 内容、封面图 ID、摘要等信息提交到微信草稿箱。
