import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TokenLimitGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Obtener información completa del usuario
    const userDetails = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionStatus: true,
        totalTokensUsed: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!userDetails) {
      return false;
    }

    // Verificar que la suscripción esté activa
    if (!this.isSubscriptionActive(userDetails)) {
      throw new BadRequestException('Tu suscripción ha expirado. Renueva tu plan para continuar usando MedMind.');
    }

    // Obtener límites según el tipo de suscripción
    const tokenLimit = this.getTokenLimit(userDetails.subscriptionStatus);
    
    // Verificar si ha excedido el límite
    if (userDetails.totalTokensUsed >= tokenLimit) {
      const limitName = this.getSubscriptionName(userDetails.subscriptionStatus);
      throw new BadRequestException(
        `Has alcanzado el límite de ${tokenLimit.toLocaleString()} tokens de tu plan ${limitName}. ` +
        'Actualiza tu suscripción para continuar chateando con los asistentes médicos.'
      );
    }

    // Agregar información de límites al request para uso posterior
    request.tokenLimits = {
      used: userDetails.totalTokensUsed,
      limit: tokenLimit,
      remaining: tokenLimit - userDetails.totalTokensUsed,
      subscription: userDetails.subscriptionStatus,
    };

    return true;
  }

  private isSubscriptionActive(user: { subscriptionStatus: string; subscriptionExpiresAt?: Date | null }): boolean {
    // Suscripciones activas sin fecha de expiración
    if (user.subscriptionStatus === 'ACTIVE') {
      return true;
    }

    // Trial activo
    if (user.subscriptionStatus === 'TRIAL' && user.subscriptionExpiresAt) {
      return new Date() < user.subscriptionExpiresAt;
    }

    return false;
  }

  private getTokenLimit(subscriptionStatus: string): number {
    const limits = {
      TRIAL: parseInt(this.configService.get<string>('TRIAL_TOKEN_LIMIT') || '10000'),
      ACTIVE: parseInt(this.configService.get<string>('BASIC_TOKEN_LIMIT') || '100000'),
      PREMIUM: parseInt(this.configService.get<string>('PREMIUM_TOKEN_LIMIT') || '500000'),
    };

    return limits[subscriptionStatus] || limits.TRIAL;
  }

  private getSubscriptionName(subscriptionStatus: string): string {
    const names = {
      TRIAL: 'Trial',
      ACTIVE: 'Básico',
      PREMIUM: 'Premium',
    };

    return names[subscriptionStatus] || 'Trial';
  }
}