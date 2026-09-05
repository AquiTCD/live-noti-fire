export interface UserRegistration {
  discordUserId: string;
  twitchUserId: string;
  registeredAt: string;
  isSubscribed?: boolean;
}

export interface ApiResponse<T> {
  message?: string;
  error?: string;
  details?: string;
  data?: T;
}
