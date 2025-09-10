import { SubscriptionStatus } from '@prisma/client';

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    university?: string;
    semester?: number;
    subscriptionStatus: SubscriptionStatus;
    roles: string[];
  };
}

export class RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
}