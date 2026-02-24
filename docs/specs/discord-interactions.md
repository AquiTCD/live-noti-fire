# Specification: Discord Slash Commands

## 1. 概要
ユーザーが Discord 上から配信通知の登録や設定を行うためのスラッシュコマンド機能。

## 2. 機能要件
- `/add-streamer`: Twitch ユーザー名を指定して、現在のサーバーに配信通知を登録。
- `/notify-settings`: 通知を送信するチャンネルの指定、および配信タイトルに基づく通知フィルタ（ルール）の設定。

## 3. 技術仕様
- **Endpoint**: `/discord/interactions`
- **Logic Flow**:
    1. Discord からの Interaction Webhook を受信。
    2. ED25519 署名の検証（Discord 公開鍵を使用）。
    3. 各コマンドのハンドラへディスパッチ。
- **Available Commands**:
    ### `/add-streamer`
    - **Options**: `twitch_username` (String)
    - **Action**: 
        1. Twitch API でユーザー ID を取得。
        2. `UserRepository` にギルドと Twitch ID の紐付けを保存。
        3. Twitch EventSub に `stream.online`/`stream.offline` をサブスクライブ。
    ### `/notify-settings`
    - **Options**: `channel` (Channel), `rules` (String, カンマ区切り)
    - **Action**: 
        1. `GuildRepository` に指定チャンネル ID とルールを保存。
