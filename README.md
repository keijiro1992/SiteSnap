# SiteSnap

URLを指定してデスクトップ・モバイル両方のフルページスクリーンショットを撮影するCLIツール。

## インストール

```bash
npm install
```

## 使い方

```bash
node sitesnap.js <URL>
```

**例:**
```bash
node sitesnap.js https://www.yahoo.co.jp
```

## 出力ファイル

- `screenshot_desktop.png` - デスクトップ版（1280x800）
- `screenshot_mobile.png` - モバイル版（iPhone、375x812）

## 依存関係

- [Puppeteer](https://pptr.dev/) - ヘッドレスブラウザ操作ライブラリ
