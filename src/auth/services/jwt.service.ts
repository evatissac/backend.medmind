import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  tokenId: string; // for token revocation
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return this.nestJwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m', // 15 minutos
    });
  }

  generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    return this.nestJwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d', // 7 días
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.nestJwtService.verify(token, {
      secret: this.configService.get<string>('JWT_SECRET'),
    });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.nestJwtService.verify(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || this.configService.get<string>('JWT_SECRET'),
    });
  }

  decodeToken(token: string): any {
    return this.nestJwtService.decode(token);
  }

  generateTokenId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}