#!/usr/bin/env node
// server.js - SiteSnap GUI Server
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/screenshots', express.static('screenshots'));

// 設定
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DESKTOP_VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 2 };
const MOBILE_VIEWPORT = { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true };
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// アクティブなSSE接続を管理
const connections = new Map();

// SSEエンドポイント
app.get('/api/progress/:id', (req, res) => {
    const { id } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    connections.set(id, res);

    req.on('close', () => {
        connections.delete(id);
    });
});

// 進捗を送信
function sendProgress(id, data) {
    const connection = connections.get(id);
    if (connection) {
        connection.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

// スクリーンショット撮影
async function takeScreenshot(page, basePath) {
    const pngPath = `${basePath}.png`;
    const jpgPath = `${basePath}.jpg`;

    await page.screenshot({ path: pngPath, fullPage: true });
    const pngSize = fs.statSync(pngPath).size;

    if (pngSize <= MAX_FILE_SIZE) {
        return {
            path: pngPath,
            filename: path.basename(pngPath),
            size: pngSize,
            format: 'png'
        };
    }

    // PNG が 5MB 超の場合、JPEG に変換
    let quality = 90;
    await page.screenshot({ path: jpgPath, fullPage: true, type: 'jpeg', quality });
    let jpgSize = fs.statSync(jpgPath).size;

    while (jpgSize > MAX_FILE_SIZE && quality > 50) {
        quality -= 10;
        await page.screenshot({ path: jpgPath, fullPage: true, type: 'jpeg', quality });
        jpgSize = fs.statSync(jpgPath).size;
    }

    fs.unlinkSync(pngPath);

    return {
        path: jpgPath,
        filename: path.basename(jpgPath),
        size: jpgSize,
        format: 'jpeg',
        quality
    };
}

// スクリーンショットAPI
app.post('/api/screenshot', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URLを指定してください' });
    }

    // URLの検証
    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: '有効なURLを入力してください' });
    }

    const jobId = randomUUID();
    const timestamp = Date.now();

    // 非同期で処理を開始
    res.json({ jobId, message: '処理を開始しました' });

    let browser;
    try {
        sendProgress(jobId, { status: 'starting', message: 'ブラウザを起動しています...', progress: 10 });

        browser = await puppeteer.launch({ headless: 'new' });

        // デスクトップ版
        sendProgress(jobId, { status: 'capturing', message: 'デスクトップ版を撮影中...', progress: 30 });

        const desktopPage = await browser.newPage();
        await desktopPage.setViewport(DESKTOP_VIEWPORT);
        await desktopPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const desktopBasePath = path.join('screenshots', `${timestamp}_desktop`);
        const desktopResult = await takeScreenshot(desktopPage, desktopBasePath);
        await desktopPage.close();

        sendProgress(jobId, { status: 'capturing', message: 'モバイル版を撮影中...', progress: 60 });

        // モバイル版
        const mobilePage = await browser.newPage();
        await mobilePage.setViewport(MOBILE_VIEWPORT);
        await mobilePage.setUserAgent(MOBILE_USER_AGENT);
        await mobilePage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const mobileBasePath = path.join('screenshots', `${timestamp}_mobile`);
        const mobileResult = await takeScreenshot(mobilePage, mobileBasePath);
        await mobilePage.close();

        await browser.close();

        sendProgress(jobId, {
            status: 'completed',
            message: '完了しました！',
            progress: 100,
            result: {
                url,
                desktop: {
                    url: `/${desktopResult.path}`,
                    filename: desktopResult.filename,
                    size: desktopResult.size,
                    format: desktopResult.format,
                    resolution: `${DESKTOP_VIEWPORT.width * DESKTOP_VIEWPORT.deviceScaleFactor} x ${DESKTOP_VIEWPORT.height * DESKTOP_VIEWPORT.deviceScaleFactor}`
                },
                mobile: {
                    url: `/${mobileResult.path}`,
                    filename: mobileResult.filename,
                    size: mobileResult.size,
                    format: mobileResult.format,
                    resolution: `${MOBILE_VIEWPORT.width * MOBILE_VIEWPORT.deviceScaleFactor} x ${MOBILE_VIEWPORT.height * MOBILE_VIEWPORT.deviceScaleFactor}`
                }
            }
        });

    } catch (error) {
        if (browser) await browser.close();

        sendProgress(jobId, {
            status: 'error',
            message: `エラーが発生しました: ${error.message}`,
            progress: 0
        });
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🚀 SiteSnap GUI Server is running at http://localhost:${PORT}`);
    console.log(`📁 Screenshots will be saved to ./screenshots`);
});
