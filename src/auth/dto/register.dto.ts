import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede tener más de 50 caracteres' })
  password: string;

  @IsString({ message: 'El nombre completo es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  fullName: string;

  @IsOptional()
  @IsString({ message: 'La universidad debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre de la universidad es muy largo' })
  university?: string;

  @IsOptional()
  @IsInt({ message: 'El semestre debe ser un número entero' })
  @Min(1, { message: 'El semestre debe ser mayor a 0' })
  @Max(12, { message: 'El semestre no puede ser mayor a 12' })
  semester?: number;
}