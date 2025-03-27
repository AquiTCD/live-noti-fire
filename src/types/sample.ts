export interface SampleData {
  id: string;
  content: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  message?: string;
  error?: string;
  details?: string;
  data?: T;
}
