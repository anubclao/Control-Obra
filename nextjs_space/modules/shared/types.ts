import { UserRole } from "@prisma/client";

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
