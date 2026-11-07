# FERMIA — The Future of Agriculture

次世代農業を、ひとつのプラットフォームに。

## ベータ版の機能
- ダッシュボード（現時点の数値はサンプル表示）
- 農場・圃場の登録、一覧、編集、削除
- 作物・作付サイクルの登録、一覧、編集、削除
- 作業予定の登録、一覧、編集、削除
- 資材・在庫の登録、一覧、編集、削除
- 収穫・生産実績の登録、一覧、編集、削除（圃場・作付との紐付け）
- 作業時間・日報の記録と集計
- 組織単位のデータ分離と役割ベースのAPI権限
- 操作履歴の記録
- スマートフォン対応レイアウト、PWA基本設定
- 管理データのCSVエクスポート

天気・AI・経営分析・出荷・センサー・機械連携は今後の拡張領域です。現時点でライブ情報や外部連携があるように表示しません。

## 技術構成
- React + TypeScript + Vite
- Cloudflare Pages（フロントエンド / Pages Functions）
- Cloudflare D1（データベース）
- Cloudflare Access JWT（API認証）
- PWA（インストール可能なWebアプリの基本設定）

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
4. マイグレーションを適用します：`npx wrangler d1 migrations apply fermia-db --remote`（0001・0002を順に適用）
5. デプロイ後、`/api/health` でD1接続状態を確認します。

### API認証（Cloudflare Access）
農場APIはCloudflare Access JWTを検証します。Pagesプロジェクトの環境変数に次を設定してください。
- `ACCESS_TEAM_DOMAIN`：AccessチームのIssuer URL（例：`https://your-team.cloudflareaccess.com`）
- `ACCESS_AUD`：対象AccessアプリケーションのAUD tag

Cloudflare Zero Trustでアプリケーションを作成し、許可する利用者・メールアドレスに限定したAccessポリシーを設定してください。API側でも署名・Issuer・Audienceを検証します。Accessを設定していない状態では農場APIは利用できません。

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

## API
- `GET /api/health`：D1接続確認
- `GET /api/farms?organization_id=...`：農場一覧
- `POST /api/farms?organization_id=...`：農場作成（owner / admin / manager）
- `PATCH /api/farms/:id?organization_id=...`：農場編集（owner / admin / manager）
- `DELETE /api/farms/:id?organization_id=...`：農場削除（owner / admin）
- `GET|POST /api/records/fields?organization_id=...`：圃場一覧・作成
- `GET|POST /api/records/crops?organization_id=...`：作物・作付一覧・作成
- `GET|POST /api/records/tasks?organization_id=...`：作業予定一覧・作成
- `GET|POST /api/records/inventory?organization_id=...`：在庫一覧・作成
- `PATCH|DELETE /api/records/:resource/:id?organization_id=...`：各記録の編集・削除
- `GET|POST /api/work-logs?organization_id=...`：作業時間記録
- `PATCH|DELETE /api/work-logs/:id?organization_id=...`：作業時間記録の編集・削除
- `GET|POST /api/harvest?organization_id=...`：収穫・生産実績
- `PATCH|DELETE /api/harvest/:id?organization_id=...`：収穫実績の編集・削除

すべての業務APIはCloudflare Access JWTとD1の組織所属を検証し、SQLをorganization_idで絞り込みます。owner/admin/manager/staff/viewerの役割を使い、viewerは読み取り専用です。農場・記録の変更は監査イベントに記録します。

## データ画面の使い方
1. Cloudflare Pages・D1・Accessの設定を完了します。
2. 管理者がD1に組織・ユーザー・所属を登録します。
3. FERMIAの「農場・圃場管理」を開き、管理者から案内された組織IDを保存します。
4. まず農場を登録し、その後圃場・作物・作業・在庫・収穫実績を登録します。

組織IDはブラウザのローカルストレージに保存されます。認証情報やパスワードはアプリに保存しません。

## 重要：公開利用前の確認事項
このリポジトリは初期ベータ実装です。Cloudflareのプロジェクト接続、D1 binding、Access設定、環境変数、マイグレーション適用、初期ユーザー登録は運用者側で行う必要があります。収穫記録を利用するには、追加マイグレーション `0002_harvest_records.sql` の適用も必要です。現時点では一般公開のユーザー登録、パスワード管理、招待フロー、データのバックアップ・復元UI、完全な監査ログ閲覧UIは未実装です。

ダッシュボードの圃場数・作物数・天気・作業表示は一部サンプルです。作業管理画面の登録データとはまだ連動しません。天気・AI・経営分析は未接続です。実際の経営データを扱う前に、実環境で認証・認可・組織分離・バックアップ・復旧手順を検証してください。特に農薬・肥料などの安全に関わる判断は、製品ラベル・法令・公的機関の情報を確認してください。

## 開発チェック
GitHub Actionsでpush / pull request時に依存関係をインストールし、`npm run build` を実行します。
