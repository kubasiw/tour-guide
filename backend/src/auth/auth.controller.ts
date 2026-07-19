import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post('register')
  public register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  public login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  public me(@Req() req: AuthenticatedRequest): {
    userId: string;
    email: string;
  } {
    return req.user;
  }
}
