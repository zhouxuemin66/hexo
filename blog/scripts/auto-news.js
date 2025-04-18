const Hexo = require('hexo');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { execSync } = require('child_process');

// 新闻接口地址
const NEWS_API = 'https://60s-api.viki.moe/v2/toutiao';
const hexoInstance = new Hexo(__dirname, {});

// 下载图片保存到本地
async function downloadImage(url, filename) {
    const imagesDir = path.join(__dirname, '../source/images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const imagePath = path.join(imagesDir, filename);
    const writer = fs.createWriteStream(imagePath);
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(`/images/${filename}`));
        writer.on('error', reject);
    });
}

// 获取新闻数据
async function fetchNews() {
    const res = await axios.get(NEWS_API);
    return res.data.data; // 只取前5条
}

// 创建 Hexo 文章
async function createPost(newsArticles) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const postLines = [];

    for (const [index, article] of newsArticles.entries()) {
        let localImg = '';
        if (article.cover) {
            const ext = path.extname(article.cover).split('?')[0] || '.jpg';
            const filename = `${dateStr}-img${index}${ext}`;
            localImg = await downloadImage(article.cover, filename);
        }

        postLines.push(`
### ${article.title}

${localImg ? `![封面图](${localImg})` : ''}

[阅读全文](${article.link})
    `);
    }

    const content = `---
title: "每日早报"
date: ${new Date().toISOString()}
tags:
  - 每日新闻
categories:
  - 新闻
---

${postLines.join('\n')}
  `;

    const postPath = path.join(__dirname, '../source/_posts', `${dateStr}-daily-news.md`);
    fs.writeFileSync(postPath, content, 'utf-8');
    console.log('✅ 成功生成文章:', postPath);
}

// 自动提交并推送到 GitHub
// function gitPush() {
//     try {
//         execSync('git add ../source/_posts', { stdio: 'inherit' });
//         execSync('git add ../source/images', { stdio: 'inherit' });
//         execSync(`git commit -m "update daily news: ${new Date().toISOString()}"`, { stdio: 'inherit' });
//         execSync('git push', { stdio: 'inherit' });
//         console.log('✅ 已提交并推送到 GitHub');
//     } catch (err) {
//         console.error('❌ Git 操作失败：', err.message);
//     }
// }


// 执行主流程
async function run() {
    await hexoInstance.init();
    const newsArticles = await fetchNews();
    await createPost(newsArticles);
    await hexoInstance.call('generate');
    // gitPush(); // 推送到 GitHub，触发 Cloudflare Pages 自动部署
}

// ✅ 启动时立即执行一次
run().catch(console.error);

// ✅ 每天早上 8 点执行一次
cron.schedule('0 8 * * *', () => {
    console.log('⏰ 每日任务启动...');
    run().catch(console.error);
});

// ✅ 保持脚本常驻运行（如非用 pm2）
setInterval(() => {}, 1000 * 60 * 60);
