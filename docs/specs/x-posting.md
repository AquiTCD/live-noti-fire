# Project Extension: Twitch-X Integration Module (Refined)

## 1. 要件定義 (Requirements Definition)

### 1.1 背景と目的
- 特定の Twitch ユーザー（オーナー）の配信開始時に、X（旧Twitter）へ自動的に告知ポストを投稿する。
- 既存の Deno / Hono システムを拡張し、最小限のコストで実現する。

### 1.2 ユーザー要件
- **対象ユーザー**: `X_TARGET_TWITCH_ID` に一致するユーザーのみ（アキさん専用）。
- **投稿内容**: 
    - プレフィックス: 環境変数 `X_POST_PREFIX` があればそれを使用、なければ `【ライブ配信開始】`。
    - 本文: `(プレフィックス) (配信タイトル) (配信URL)`。
    - ハッシュタグは不要。
- **投稿頻度**: 月30回程度。X API Free Tier（24時間50ポストまで）の枠内で十分に運用可能。
- **Discord 連携**: 現状維持（Embed でタイトルが表示されているため変更なし）。
- **二重投稿防止**: 同一 `stream_id` に対して6時間以内に複数回投稿しない。

---

## 2. 技術要件定義 (Technical Requirements Document)

### 2.1 構成
- **Runtime**: Deno
- **Database**: Deno KV (重複排除用)
- **API**: X API v2 (POST /2/tweets)
- **Auth**: OAuth 1.0a (User Context)

### 2.2 必要な環境変数 (.env)
- `X_CONSUMER_KEY`
- `X_CONSUMER_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_SECRET`
- `X_TARGET_TWITCH_ID`: ポスト対象とする Twitch ユーザー ID
- `X_POST_PREFIX`: (任意) デフォルトは `【ライブ配信開始】`

### 2.3 実装詳細
#### ① XService (`src/services/x.service.ts`)
- OAuth 1.0a 署名（HMAC-SHA256）を生成し、X API へポストする。
- 既存の `TwitchService.computeHmac` を参考に実装、または JSR のパッケージを検討。

#### ② XPostHistoryRepository (`src/repositories/x-post-history.repository.ts`)
- キー: `["x_posted_history", stream_id]`
- TTL: 6時間 (`expireIn: 21600000`)
- `stream_online` イベント発生時に、このレポジトリをチェックして未投稿なら投稿処理へ。

#### ③ TwitchController (`src/controllers/twitch.controller.ts`)
- `stream.online` 処理フローの中で以下を追加：
    ```typescript
    if (broadcasterId === getEnvVar("X_TARGET_TWITCH_ID")) {
        // 二重投稿チェック
        // 未投稿なら XService.postTweet() を呼び出し
        // KV に投稿済みとして記録
    }
    ```

---

## 3. マイルストーン
1. 環境変数の設定とバリデーション追加
2. Deno KV を使った二重投稿防止レポジトリの実装
3. OAuth 1.0a 署名ロジック & XService の実装
4. TwitchController への組み込みと結合テスト
