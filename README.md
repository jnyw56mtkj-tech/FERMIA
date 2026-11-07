# FERMIA — The Future of Agriculture

次世代農業を、ひとつのプラットフォームに。

## 技術構成
- React + TypeScript + Vite
- PWA基本設定
- Cloudflare Pages向け構成

## ローカル開発
```bash
npm install
npm run dev
```

## Cloudflare Pages
GitHubリポジトリをCloudflare Pagesに接続し、Build commandを `npm run build`、Build output directoryを `dist` に設定してください。

## 現在の状態
このリポジトリは初期UIプロトタイプです。農場・作物・天気の表示はデモ用です。作業の追加・完了切替は画面内の一時状態のみです。AI・天気APIは未接続です。

## 本番利用前の必須作業
認証、サーバー側の権限確認、組織/農場ごとのデータ分離、永続DB、バックアップ、監査ログを実装するまでは、実際の経営データや個人情報を登録しないでください。
