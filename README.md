# Live-Noti-Fire

## Sequence Diagrams

### 1. Initial Registration Flow
```mermaid
sequenceDiagram
    actor User
    participant Discord
    participant App
    participant KV
    participant Twitch

    User->>Discord: /live-register command
    Discord->>App: POST /discord/commands
    Note right of App: Validate command

    alt Valid Command
        App->>KV: Store user registration info
        App->>Twitch: Subscribe to stream events

        alt Subscription Success
            Twitch-->>App: Challenge callback
            App->>KV: Update registration as complete
            App-->>Discord: Send success message
        else Subscription Failed
            App->>KV: Update registration as failed
            App-->>Discord: Send error message
        end

    else Invalid Command
        App-->>Discord: Send validation error
    end
```

### 2. Stream Start Flow
```mermaid
sequenceDiagram
    participant Twitch
    participant App
    participant KV
    participant Discord

    Twitch->>App: POST /webhook/twitch (stream.online)
    Note right of App: Validate webhook

    alt Valid Webhook
        App->>KV: Get registered user info

        alt User Found
            App->>Discord: Send notification message
            Discord-->>App: Return message ID
            App->>KV: Store message ID
        else User Not Found
            Note right of App: Log error
        end

    else Invalid Webhook
        App-->>Twitch: Return 400 Bad Request
    end
```

### 3. Stream End Flow
```mermaid
sequenceDiagram
    participant Twitch
    participant App
    participant KV
    participant Discord

    Twitch->>App: POST /webhook/twitch (stream.offline)
    Note right of App: Validate webhook

    alt Valid Webhook
        App->>KV: Get message ID & user info

        alt Found Message ID
            App->>Discord: Add end-stream reaction
            alt Reaction Success
                Note right of App: Complete
            else Reaction Failed
                Note right of App: Log error
            end
        else Not Found
            Note right of App: Log error
        end

    else Invalid Webhook
        App-->>Twitch: Return 400 Bad Request
    end
