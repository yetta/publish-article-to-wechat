import cron from 'node-cron';
import dotenv from 'dotenv';
import publishTodayNote from './index.js';
import logger from './src/logger.js';

// 加载环境变量
dotenv.config();

const cronExpression = process.env.SCHEDULE_CRON || '0 7 * * *';

logger.info('========== 启动定时任务 ==========');
logger.info(`定时任务表达式: ${cronExpression}`);
logger.info('默认每日 7:00 AM 自动发布笔记');
logger.info('按 Ctrl+C 停止');

// 定时任务：每天早上 7:00 执行
// Cron 表达式: 分 时 日 月 周
// 0 7 * * * = 每天 7:00
cron.schedule(cronExpression, async () => {
    logger.info('\n========== 定时任务触发 ==========');
    try {
        const result = await publishTodayNote();
        if (result.success) {
            logger.success(`定时任务完成！草稿已发布`);
        } else {
            logger.warn(`定时任务结束: ${result.reason}`);
        }
    } catch (error) {
        logger.error('定时任务执行失败', error);
    }
}, {
    timezone: 'Asia/Shanghai'
});

logger.success('定时任务已启动，等待执行...');

// 可选：立即执行一次（用于测试）
// logger.info('\n立即执行一次测试...');
// publishTodayNote().catch(error => logger.error('测试执行失败', error));
