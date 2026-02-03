#!/usr/bin/env node
// sitesnap.js - SiteSnap: Webページスクリーンショットツール
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// コマンドライン引数からURLを取得する (例: node sitesnap.js https://google.com)
const targetUrl = process.argv[2];

if (!targetUrl) {
    console.error('❌ エラー: URLを指定してください。');
    console.log('使い方の例: node sitesnap.js https://www.google.com');
    process.exit(1);
}

// 設定
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DESKTOP_VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 2 }; // 3840x2160相当
const MOBILE_VIEWPORT = { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true }; // iPhone 15 Pro Max相当

// モバイルのUser Agent (iPhone 15 Pro Max)
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * スクリーンショットを撮影し、5MB以下に収める
 * PNGで5MB超の場合はJPEGで再保存
 */
async function takeScreenshot(page, baseName) {
    const pngPath = `${baseName}.png`;
    const jpgPath = `${baseName}.jpg`;

    // まずPNGで保存
    await page.screenshot({ path: pngPath, fullPage: true });
    const pngSize = fs.statSync(pngPath).size;

    if (pngSize <= MAX_FILE_SIZE) {
        const sizeMB = (pngSize / 1024 / 1024).toFixed(2);
        console.log(`   📁 ${pngPath} (${sizeMB}MB)`);
        return pngPath;
    }

    // PNGが5MB超の場合、JPEGで保存
    console.log(`   ⚠️  PNG ${(pngSize / 1024 / 1024).toFixed(2)}MB > 5MB、JPEGに変換中...`);

    // 品質を調整してJPEGで再保存
    let quality = 90;
    await page.screenshot({ path: jpgPath, fullPage: true, type: 'jpeg', quality });
    let jpgSize = fs.statSync(jpgPath).size;

    // 5MB以下になるまで品質を下げる
    while (jpgSize > MAX_FILE_SIZE && quality > 50) {
        quality -= 10;
        await page.screenshot({ path: jpgPath, fullPage: true, type: 'jpeg', quality });
        jpgSize = fs.statSync(jpgPath).size;
    }

    // PNGを削除
    fs.unlinkSync(pngPath);

    const sizeMB = (jpgSize / 1024 / 1024).toFixed(2);
    console.log(`   📁 ${jpgPath} (${sizeMB}MB, quality: ${quality}%)`);
    return jpgPath;
}

(async () => {
    console.log('🚀 ブラウザを起動しています...');
    console.log(`📐 高解像度モード: デスクトップ ${DESKTOP_VIEWPORT.width * DESKTOP_VIEWPORT.deviceScaleFactor}x, モバイル ${MOBILE_VIEWPORT.width * MOBILE_VIEWPORT.deviceScaleFactor}x`);

    // ブラウザを起動 (headless: "new" は最新のヘッドレスモード推奨設定)
    const browser = await puppeteer.launch({ headless: "new" });

    try {
        console.log(`🌐 ${targetUrl} にアクセス中...`);

        // === デスクトップ版スクリーンショット ===
        console.log('🖥️  デスクトップ版を撮影中...');
        const desktopPage = await browser.newPage();
        await desktopPage.setViewport(DESKTOP_VIEWPORT);
        await desktopPage.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await takeScreenshot(desktopPage, 'screenshot_desktop');
        await desktopPage.close();

        // === モバイル版スクリーンショット ===
        console.log('📱 モバイル版を撮影中...');
        const mobilePage = await browser.newPage();
        await mobilePage.setViewport(MOBILE_VIEWPORT);
        await mobilePage.setUserAgent(MOBILE_USER_AGENT);
        await mobilePage.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await takeScreenshot(mobilePage, 'screenshot_mobile');
        await mobilePage.close();

        console.log('✅ 完了！両方のスクリーンショットを保存しました。');
    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
    } finally {
        // 必ずブラウザを閉じる
        await browser.close();
    }
})();

