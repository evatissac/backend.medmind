import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthResponseDto, RefreshResponseDto } from '../dto/auth-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CurrentUserData } from '../decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    
    return {
      message: '¡Registro exitoso! Bienvenido a MedMind',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    
    return {
      message: '¡Login exitoso! Bienvenido de vuelta',
      data: result,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    
    return {
      message: 'Token renovado exitosamente',
      data: result,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: CurrentUserData) {
    // En el futuro implementar blacklist de tokens
    // Por ahora simplemente confirmamos logout
    return {
      message: 'Logout exitoso. ¡Hasta pronto!',
      data: null,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return {
      message: 'Información del usuario obtenida',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles,
          permissions: user.permissions,
        },
      },
    };
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, changePasswordDto);
    
    return {
      message: 'Contraseña cambiada exitosamente',
      data: null,
    };
  }

  // Endpoint para validar si un token es válido (útil para el frontend)
  @Get('validate')
  @UseGuards(JwtAuthGuard)
  async validateToken(@CurrentUser() user: CurrentUserData) {
    return {
      message: 'Token válido',
      data: {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles,
        },
      },
    };
  }
}