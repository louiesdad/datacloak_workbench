export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    status?: number;
  };
}

export interface SuccessResponse<T = any> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}