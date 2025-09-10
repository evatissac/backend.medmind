import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // Usar email en lugar de username
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    try {
      const result = await this.authService.login({ email, password });
      return result.user; // Retornar solo el usuario para el guard
    } catch (error) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }
}