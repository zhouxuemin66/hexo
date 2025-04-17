const hexo = require('hexo');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// 新闻接口地址
const NEWS_API = 'https://60s-api.viki.moe/v2/toutiao';
const hexoInstance = new hexo(__dirname, {});

// 下载图片保存到本地
async function downloadImage(url, filename) {
  // 使用相对路径指向source目录下的images
  const imagesDir = path.join('source', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  const imagePath = path.join(imagesDir, filename);
  const writer = fs.createWriteStream(imagePath);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(`/images/${filename}`)); // Hexo访问路径保持不变
    writer.on('error', reject);
  });
}

// 获取新闻数据
async function fetchNews() {
  const res = await axios.get(NEWS_API);
  return res.data.data; // 截取前5条
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

  // 使用相对路径生成文章
  const postPath = path.join('source', '_posts', `${dateStr}-daily-news.md`);
  fs.writeFileSync(postPath, content, 'utf-8');
  console.log('✅ 成功生成文章:', postPath);
}

// 手动运行
async function run() {
  await hexoInstance.init();
  const newsArticles = await fetchNews();
  await createPost(newsArticles);
  await hexoInstance.call('generate');
  await hexoInstance.call('deploy');
}

run().catch(console.error);
