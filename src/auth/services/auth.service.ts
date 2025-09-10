import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException,
  ConflictException 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { JwtTokenService, JwtPayload } from './jwt.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, fullName, university, semester } = registerDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    // Validar fortaleza de la contraseña
    const passwordValidation = this.passwordService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'La contraseña no cumple con los requisitos de seguridad',
        errors: passwordValidation.errors,
      });
    }

    // Hash de la contraseña
    const hashedPassword = await this.passwordService.hashPassword(password);

    // Obtener el rol de estudiante por defecto
    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'student' },
    });

    if (!studentRole) {
      throw new BadRequestException('Error de configuración del sistema');
    }

    // Crear usuario en una transacción
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          fullName,
          university,
          semester,
          subscriptionStatus: 'TRIAL',
          subscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días de trial
        },
      });

      // Asignar rol de estudiante
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: studentRole.id,
        },
      });

      return newUser;
    });

    // Generar tokens
    const tokenId = this.jwtTokenService.generateTokenId();
    
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roles: ['student'],
    });

    const refreshToken = this.jwtTokenService.generateRefreshToken({
      sub: user.id,
      tokenId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        university: user.university || undefined,
        semester: user.semester || undefined,
        subscriptionStatus: user.subscriptionStatus,
        roles: ['student'],
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Buscar usuario con roles
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    // Verificar contraseña
    const isPasswordValid = await this.passwordService.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar último login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Obtener roles activos
    const roles = user.userRoles.map(ur => ur.role.name);

    // Generar tokens
    const tokenId = this.jwtTokenService.generateTokenId();
    
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roles,
    });

    const refreshToken = this.jwtTokenService.generateRefreshToken({
      sub: user.id,
      tokenId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        university: user.university || undefined,
        semester: user.semester || undefined,
        subscriptionStatus: user.subscriptionStatus,
        roles,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verificar refresh token
      const payload = this.jwtTokenService.verifyRefreshToken(refreshToken);

      // Buscar usuario con roles
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            include: {
              role: true,
            },
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
              ],
            },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Token inválido');
      }

      // Obtener roles activos
      const roles = user.userRoles.map(ur => ur.role.name);

      // Generar nuevos tokens
      const newTokenId = this.jwtTokenService.generateTokenId();
      
      const newAccessToken = this.jwtTokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        roles,
      });

      const newRefreshToken = this.jwtTokenService.generateRefreshToken({
        sub: user.id,
        tokenId: newTokenId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await this.passwordService.verifyPassword(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // Validar nueva contraseña
    const passwordValidation = this.passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'La nueva contraseña no cumple con los requisitos de seguridad',
        errors: passwordValidation.errors,
      });
    }

    // Hash de la nueva contraseña
    const hashedNewPassword = await this.passwordService.hashPassword(newPassword);

    // Actualizar contraseña
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword },
    });
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Construir objeto de usuario con roles y permisos
    const roles = user.userRoles.map(ur => ur.role.name);
    const permissions = user.userRoles.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions: [...new Set(permissions)], // Eliminar duplicados
    };
  }
}