import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  function runGuard(isAuthenticated: boolean): boolean | UrlTree {
    const urlTree = {} as UrlTree;
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        { provide: Router, useValue: { parseUrl: () => urlTree } },
      ],
    });

    return TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as boolean | UrlTree;
  }

  it('allows access when authenticated', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('redirects to /login when not authenticated', () => {
    const result = runGuard(false);
    expect(result).not.toBe(true);
  });
});
