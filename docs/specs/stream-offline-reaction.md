# Specification: Stream Offline Reaction

## 1. 概要
配信が終了した際、以前送信した Discord の通知メッセージにリアクション（🚫）を追加し、配信が終わったことを視覚的に示す機能。

## 2. 機能要件
- Twitch EventSub の `stream.offline` イベントを検知。
- 送信済みの通知メッセージを特定。
- Discord API を使用してリアクションを追加。
- 送信済み通知データのクリーンアップ。

## 3. 技術仕様
- **Logic Flow**:
    1. `stream.offline` Webhook 受信。
    2. `ActiveStreamRepository` から配信中フラグを削除。
    3. `NotificationRepository` から、その配信者に関連する各ギルドの `message_id` と `channel_id` を取得。
    4. Discord API (`addReaction`) でリアクションを追加。
    5. `NotificationRepository` から当該エントリーを削除。
