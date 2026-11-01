export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'HOD' | 'CLASS_INCHARGE' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  institutionId: string;
  institutionName?: string;
  institutionCode?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleType;
  mustResetPassword: boolean;
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  refreshToken?: string;
  user: User;
}
