#!/usr/bin/env node
// sitesnap.js - SiteSnap: Webページスクリーンショットツール
const puppeteer = require('puppeteer');

// コマンドライン引数からURLを取得する (例: node sitesnap.js https://google.com)
const targetUrl = process.argv[2];

if (!targetUrl) {
    console.error('❌ エラー: URLを指定してください。');
    console.log('使い方の例: node sitesnap.js https://www.google.com');
    process.exit(1);
}

// モバイルのUser Agent (iPhone)
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

(async () => {
    console.log('🚀 ブラウザを起動しています...');

    // ブラウザを起動 (headless: "new" は最新のヘッドレスモード推奨設定)
    const browser = await puppeteer.launch({ headless: "new" });

    try {
        console.log(`🌐 ${targetUrl} にアクセス中...`);

        // === デスクトップ版スクリーンショット ===
        const desktopPage = await browser.newPage();
        await desktopPage.setViewport({ width: 1280, height: 800 });
        await desktopPage.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await desktopPage.screenshot({ path: 'screenshot_desktop.png', fullPage: true });
        console.log('🖥️  デスクトップ版を保存しました: screenshot_desktop.png');
        await desktopPage.close();

        // === モバイル版スクリーンショット ===
        const mobilePage = await browser.newPage();
        await mobilePage.setViewport({ width: 375, height: 812, isMobile: true });
        await mobilePage.setUserAgent(MOBILE_USER_AGENT);
        await mobilePage.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await mobilePage.screenshot({ path: 'screenshot_mobile.png', fullPage: true });
        console.log('📱 モバイル版を保存しました: screenshot_mobile.png');
        await mobilePage.close();

        console.log('✅ 完了！両方のスクリーンショットを保存しました。');
    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
    } finally {
        // 必ずブラウザを閉じる
        await browser.close();
    }
})();
