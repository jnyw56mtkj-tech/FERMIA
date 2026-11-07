# FERMIA — The Future of Agriculture

次世代農業を、ひとつのプラットフォームに。

## 技術構成
- React + TypeScript + Vite
- Cloudflare Pages（フロントエンド / Pages Functions）
- Cloudflare D1（データベース基盤）
- PWA基本設定

## ローカル開発
```bash
npm install
npm run dev
```

## Cloudflare Pages
GitHubリポジトリをCloudflare Pagesに接続し、Build commandを `npm run build`、Build output directoryを `dist` に設定してください。

D1を接続する手順：
1. CloudflareダッシュボードまたはWrangler CLIでD1データベースを作成します（例：`npx wrangler d1 create fermia-db`）。
2. 表示されたDatabase IDを `wrangler.toml` のD1設定例に反映し、Pagesプロジェクトにも `DB` という名前のD1 bindingを追加します。
3. マイグレーションを適用します：`npx wrangler d1 migrations apply fermia-db --remote`
4. デプロイ後、`/api/health` でAPIとD1接続状態を確認します。

ローカルDBに適用する場合は `--local` を使用してください。Cloudflare Pagesのローカル開発では `wrangler pages dev` を利用できます。

## D1データモデル
`migrations/0001_initial_schema.sql` に以下の初期テーブルを用意しています。
- 組織・ユーザー・所属と役割（owner / admin / manager / staff / viewer）
- 農場・圃場・作付サイクル
- 作業予定・作業記録
- 資材在庫・入出庫履歴
- 監査イベント

主要な業務テーブルは `organization_id` を持ち、複合外部キーで農場・圃場・所属ユーザーの組織境界を守るデータモデルです。これはDB設計上の土台であり、API側の認証・認可が完成したことを意味しません。

## 現在の状態と安全上の注意
このリポジトリは初期UIプロトタイプです。農場・作物・天気の表示はデモ用です。作業の追加・完了切替は画面内の一時状態のみです。AI・天気APIは未接続です。 `/api/health` はD1接続確認のみを行い、業務データのCRUD APIやログイン機能はまだ提供しません。

認証、サーバー側の権限確認、組織/農場ごとのデータ分離を行うAPI、バックアップ、監査ログ運用を実装・検証するまでは、実際の経営データや個人情報を登録しないでください。D1を接続しただけでは本番利用可能にはなりません。

## 開発チェック
GitHub Actionsでpush / pull request時に依存関係をインストールし、`npm run build` を実行します。
