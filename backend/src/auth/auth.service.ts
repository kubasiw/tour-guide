import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

const SALT_ROUNDS = 10;

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

  private async buildToken(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({ sub: userId, email });
    return { accessToken };
  }
}
