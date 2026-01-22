import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import logger from './logger.js';

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';

class WechatAPI {
    constructor(appId, appSecret) {
        this.appId = appId;
        this.appSecret = appSecret;
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }

    /**
     * 获取 access_token
     * @returns {Promise<string>}
     */
    async getAccessToken() {
        const now = Date.now();

        // 如果 token 未过期，直接返回缓存的 token
        if (this.accessToken && now < this.tokenExpireTime) {
            return this.accessToken;
        }

        logger.info('正在获取微信 access_token...');

        try {
            const response = await axios.get(`${WECHAT_API_BASE}/token`, {
                params: {
                    grant_type: 'client_credential',
                    appid: this.appId,
                    secret: this.appSecret
                }
            });

            if (response.data.errcode) {
                throw new Error(`获取 access_token 失败: ${response.data.errmsg}`);
            }

            this.accessToken = response.data.access_token;
            // token 有效期 2 小时，提前 5 分钟刷新
            this.tokenExpireTime = now + (response.data.expires_in - 300) * 1000;

            logger.success('成功获取 access_token');
            return this.accessToken;
        } catch (error) {
            logger.error('获取 access_token 失败', error);
            throw error;
        }
    }

    /**
     * 上传永久素材 (图片)
     * @param {string} imagePath - 本地图片路径
     * @param {string} type - 素材类型: image, thumb
     * @returns {Promise<{media_id: string, url: string}>}
     */
    async uploadMaterial(imagePath, type = 'image') {
        const accessToken = await this.getAccessToken();

        logger.info(`正在上传素材: ${path.basename(imagePath)} (${type})`);

        try {
            const formData = new FormData();
            formData.append('media', fs.createReadStream(imagePath));

            const response = await axios.post(
                `${WECHAT_API_BASE}/material/add_material`,
                formData,
                {
                    params: {
                        access_token: accessToken,
                        type: type
                    },
                    headers: formData.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            if (response.data.errcode) {
                throw new Error(`上传素材失败: ${response.data.errmsg}`);
            }

            logger.success(`素材上传成功: media_id=${response.data.media_id}`);
            return {
                media_id: response.data.media_id,
                url: response.data.url || ''
            };
        } catch (error) {
            logger.error(`上传素材失败: ${imagePath}`, error);
            throw error;
        }
    }

    /**
     * 上传图文消息内的图片 (用于正文图片)
     * @param {string} imagePath - 本地图片路径
     * @returns {Promise<string>} - 图片 URL
     */
    async uploadContentImage(imagePath) {
        const accessToken = await this.getAccessToken();

        logger.info(`正在上传正文图片: ${path.basename(imagePath)}`);

        try {
            const formData = new FormData();
            formData.append('media', fs.createReadStream(imagePath));

            const response = await axios.post(
                `${WECHAT_API_BASE}/media/uploadimg`,
                formData,
                {
                    params: {
                        access_token: accessToken
                    },
                    headers: formData.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            if (response.data.errcode) {
                throw new Error(`上传图片失败: ${response.data.errmsg}`);
            }

            logger.success(`图片上传成功: ${response.data.url}`);
            return response.data.url;
        } catch (error) {
            logger.error(`上传图片失败: ${imagePath}`, error);
            throw error;
        }
    }

    /**
     * 创建草稿
     * @param {object} article - 文章内容
     * @param {string} article.title - 标题
     * @param {string} article.content - HTML 内容
     * @param {string} article.digest - 摘要
     * @param {string} article.thumbMediaId - 封面图 media_id
     * @param {string} article.author - 作者
     * @returns {Promise<{media_id: string}>}
     */
    async createDraft(article) {
        const accessToken = await this.getAccessToken();

        logger.info(`正在创建草稿: ${article.title}`);

        try {
            const response = await axios.post(
                `${WECHAT_API_BASE}/draft/add`,
                {
                    articles: [{
                        title: article.title,
                        author: article.author || '硅基Daily',
                        digest: article.digest || '',
                        content: article.content,
                        thumb_media_id: article.thumbMediaId,
                        need_open_comment: 0,
                        only_fans_can_comment: 0
                    }]
                },
                {
                    params: {
                        access_token: accessToken
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.errcode) {
                throw new Error(`创建草稿失败: ${response.data.errmsg}`);
            }

            logger.success(`草稿创建成功: media_id=${response.data.media_id}`);
            return {
                media_id: response.data.media_id
            };
        } catch (error) {
            logger.error('创建草稿失败', error);
            throw error;
        }
    }

    /**
     * 获取草稿列表
     * @param {number} offset - 偏移量
     * @param {number} count - 数量
     * @returns {Promise<object>}
     */
    async getDraftList(offset = 0, count = 10) {
        const accessToken = await this.getAccessToken();

        try {
            const response = await axios.post(
                `${WECHAT_API_BASE}/draft/batchget`,
                {
                    offset,
                    count,
                    no_content: 0
                },
                {
                    params: {
                        access_token: accessToken
                    }
                }
            );

            if (response.data.errcode) {
                throw new Error(`获取草稿列表失败: ${response.data.errmsg}`);
            }

            return response.data;
        } catch (error) {
            logger.error('获取草稿列表失败', error);
            throw error;
        }
    }
}

export default WechatAPI;
