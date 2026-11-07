# FERMIA — The Future of Agriculture

次世代農業を、ひとつのプラットフォームに。

## 技術構成
- React + TypeScript + Vite
- Cloudflare Pages（フロントエンド / Pages Functions）
- Cloudflare D1（データベース）
- Cloudflare Access JWT（API認証）
- PWA基本設定

## ローカル開発
```bash
npm install
npm run dev
```

## Cloudflare Pages の初期設定
GitHubリポジトリをCloudflare Pagesに接続し、Build commandを `npm run build`、Build output directoryを `dist` に設定してください。

### D1データベース
1. CloudflareダッシュボードまたはWrangler CLIでD1を作成します：`npx wrangler d1 create fermia-db`
2. 表示されたDatabase IDを `wrangler.toml` のD1設定例に設定します。
3. PagesプロジェクトのSettings → Functions → D1 database bindingsで、binding名を `DB` にして同じD1を接続します。
4. マイグレーションを適用します：`npx wrangler d1 migrations apply fermia-db --remote`
5. デプロイ後、`/api/health` でD1接続状態を確認します。

### API認証（Cloudflare Access）
農場APIはCloudflare Access JWTを検証します。Pagesプロジェクトの環境変数に次を設定してください。
- `ACCESS_TEAM_DOMAIN`：AccessチームのIssuer URL（例：`https://your-team.cloudflareaccess.com`）
- `ACCESS_AUD`：対象AccessアプリケーションのAUD tag

Cloudflare Zero Trustでアプリケーションを作成し、利用者に適切なAccessポリシーを設定してください。API側でも署名・Issuer・Audienceを検証します。Accessを設定していない状態では農場APIは利用できません。

### 最初の組織・ユーザー登録
現段階では一般公開の自己登録機能はありません。管理者が本人確認と利用許可を済ませた後、D1に組織・ユーザー・所属を作成してください。例：
```sql
INSERT INTO organizations (id, name) VALUES ('org-example', 'サンプル農場法人');
INSERT INTO users (id, email, display_name)
VALUES ('user-example', 'authorized-user@example.com', '管理者');
INSERT INTO memberships (organization_id, user_id, role)
VALUES ('org-example', 'user-example', 'owner');
```
上記は形式を示す例です。実際の利用者のメールアドレスと組織情報に置き換え、本人の同意なくユーザーを登録しないでください。

## 実装済みAPI
- `GET /api/health`：D1接続確認
- `GET /api/farms?organization_id=...`：所属組織の農場一覧
- `POST /api/farms?organization_id=...`：農場作成（owner / admin / manager）
- `PATCH /api/farms/:id?organization_id=...`：農場編集（owner / admin / manager）
- `DELETE /api/farms/:id?organization_id=...`：農場削除（owner / admin）

すべての農場APIはCloudflare Access JWTとD1の組織所属を検証し、SQLも必ずorganization_idで絞り込みます。操作は監査イベントに記録します。

## D1データモデル
`migrations/0001_initial_schema.sql` に以下のテーブルを用意しています。
- 組織・ユーザー・所属と役割（owner / admin / manager / staff / viewer）
- 農場・圃場・作付サイクル
- 作業予定・作業記録
- 資材在庫・入出庫履歴
- 監査イベント

## 現在の状態と安全上の注意
画面の農場・作物・天気・作業予定はまだデモ表示です。今回追加した農場APIはバックエンドの基盤であり、既存画面とはまだ接続していません。圃場・作物・作業・在庫のCRUD APIもこれから追加します。AI・天気APIも未接続です。

Cloudflare Access、D1 binding、環境変数、マイグレーション、初期ユーザー所属の設定が済むまではAPIは利用できません。実際の経営データを扱う前に、認証・認可・組織分離・バックアップ・監査ログ・復旧手順を実環境で検証してください。

## 開発チェック
GitHub Actionsでpush / pull request時に依存関係をインストールし、`npm run build` を実行します。
