export interface UserRegistration {
  discordUserId: string;
  twitchUserId: string;
  registeredAt: string;
  isSubscribed?: boolean;
}

export interface DiscordSlashCommand {
  type: number;
  data: {
    id: string;
    name: string;
    options?: Array<{
      name: string;
      type: number;
      value: string;
    }>;
  };
  member?: {
    user: {
      id: string;
    };
  };
}

export interface ApiResponse<T> {
  message?: string;
  error?: string;
  details?: string;
  data?: T;
}
