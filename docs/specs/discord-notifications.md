# Specification: Discord Stream Notifications

## 1. 概要
Twitch の配信開始（`stream.online`）イベントを検知し、連携されている Discord サーバーの指定チャンネルに通知を送信する機能。

## 2. 機能要件
- Twitch EventSub からの Webhook 受信。
- Webhook 署名の検証（Twitch 共有シークレットを使用）。
- 配信中ストリームの管理（Deno KV）による重複通知の防止。
- ユーザーごとの通知設定（対象 Twitch ID の登録）。
- ギルド（Discord サーバー）ごとの通知設定（送信先チャンネル、タイトルフィルタ）。

## 3. 技術仕様
- **Webhook Endpoint**: `/twitch/webhooks`
- **Logic Flow**:
    1. Webhook 検証
    2. 配信情報の取得（Twitch Helix API）
    3. `ActiveStreamRepository` で重複確認
    4. `UserRepository` で配信者のギルドリスト取得
    5. 各ギルドの設定（`GuildRepository`）に従い、Discord Embed を作成・送信
    6. `NotificationRepository` にメッセージ ID を保存（終了イベント用）
- **Storage (Deno KV)**:
    - `"active_streams"`: 配信状態の追跡
    - `"users"`, `"twitch_to_discord"`: ユーザー紐付け
    - `"guild_id"`: ギルド設定
