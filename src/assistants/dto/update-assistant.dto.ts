import { IsString, IsOptional, MinLength, MaxLength, IsIn, IsBoolean } from 'class-validator';

const MEDICAL_SPECIALTIES = [
  'cardiologia',
  'neurologia',
  'medicina_interna',
  'pediatria',
  'ginecologia',
  'urologia',
  'traumatologia',
  'dermatologia',
  'psiquiatria',
  'oftalmologia',
  'otorrinolaringologia',
  'anestesiologia',
  'radiologia',
  'patologia',
  'medicina_familiar',
  'medicina_emergencia',
  'oncologia',
  'endocrinologia',
  'gastroenterologia',
  'neumologia',
  'nefrologia',
  'reumatologia',
  'infectologia',
  'hematologia',
  'medicina_intensiva',
] as const;

export class UpdateAssistantDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'La especialidad debe ser una cadena de texto' })
  @IsIn(MEDICAL_SPECIALTIES, { 
    message: `La especialidad debe ser una de: ${MEDICAL_SPECIALTIES.join(', ')}` 
  })
  specialty?: string;

  @IsOptional()
  @IsString({ message: 'Las instrucciones deben ser una cadena de texto' })
  @MinLength(10, { message: 'Las instrucciones deben tener al menos 10 caracteres' })
  @MaxLength(32000, { message: 'Las instrucciones son demasiado largas' })
  instructions?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La descripción no puede tener más de 500 caracteres' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser verdadero o falso' })
  isActive?: boolean;
}