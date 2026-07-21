import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 60;
// No environment-based frontend URL config exists yet — same hardcoded-localhost
// precedent already used for CORS in main.ts.
const FRONTEND_URL = 'http://localhost:4200';
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'Jeśli podany adres e-mail jest zarejestrowany, wysłaliśmy na niego link do resetu hasła.';

@Injectable()
export class AuthService {
  public constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  public async register(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usersService.create(email, passwordHash);
    return this.buildToken(user.id, user.email);
  }

  public async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildToken(user.id, user.email);
  }

  public async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (user) {
      await this.usersService.deletePasswordResetTokens(user.id);

      const rawToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(
        Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
      );
      await this.usersService.createPasswordResetToken(
        user.id,
        this.hashToken(rawToken),
        expiresAt,
      );

      // No email-sending integration exists yet — log the reset link instead,
      // matching this app's free/no-key-API-only approach so far.
      console.log(
        `Password reset link for ${email}: ${FRONTEND_URL}/reset-password?token=${rawToken}`,
      );
    }

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  public async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const record = await this.usersService.findPasswordResetToken(
      this.hashToken(token),
    );

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Link do resetu hasła jest nieprawidłowy lub wygasł.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.usersService.updatePassword(record.userId, passwordHash);
    await this.usersService.deletePasswordResetTokens(record.userId);

    return { message: 'Hasło zostało zmienione.' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buildToken(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({ sub: userId, email });
    return { accessToken };
  }
}
