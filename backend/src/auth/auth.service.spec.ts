import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed-token') },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a user with a hashed password and returns a token', async () => {
      let storedHash = '';
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(
        (email: string, passwordHash: string) => {
          storedHash = passwordHash;
          return Promise.resolve({ id: 'user-1', email });
        },
      );

      const result = await authService.register('a@b.com', 'password123');

      expect(await bcrypt.compare('password123', storedHash)).toBe(true);
      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('rejects when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'user-1' });

      await expect(
        authService.register('a@b.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash,
      });

      const result = await authService.login('a@b.com', 'password123');

      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.login('a@b.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash,
      });

      await expect(
        authService.login('a@b.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
