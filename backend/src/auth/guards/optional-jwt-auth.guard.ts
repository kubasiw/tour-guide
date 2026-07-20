import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUserPayload } from '../current-user.decorator';

// Like JwtAuthGuard, but never rejects the request for a missing/invalid
// token — used on endpoints that must stay usable anonymously (per "Auth is
// not a hard gate") while still attaching the caller's identity when they
// happen to be logged in.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  public handleRequest<TUser = CurrentUserPayload>(
    _err: unknown,
    user: TUser,
  ): TUser {
    return user;
  }
}
