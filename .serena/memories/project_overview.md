# Project Overview: live-noti-fire

## Purpose
A Deno-based system that monitors Twitch streams via EventSub and sends notifications to Discord and X (Twitter).

## Tech Stack
- **Runtime**: Deno
- **Framework**: Hono
- **Database**: Deno KV
- **Deployment**: Deno Deploy

## Core Structure
- `src/index.ts`: Entry point, defines Hono app and routes.
- `src/controllers/`: Request handlers for Twitch, Discord, and Debugging.
- `src/services/`: Core logic for Twitch API, Discord API, and X API.
- `src/repositories/`: Data access layer using Deno KV.
- `src/types/`: TypeScript interfaces and environment variable validation.
- `docs/specs/`: Detailed functional specifications.
