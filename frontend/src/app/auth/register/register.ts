import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../auth.service';
import { Loader } from '../../shared/loader/loader';
import { extractErrorMessage } from '../../core/http-error';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, NgbAlert, Loader],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: [
      '',
      [(c: AbstractControl) => Validators.required(c), (c: AbstractControl) => Validators.email(c)],
    ],
    password: ['', [(c: AbstractControl) => Validators.required(c), Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.register(email, password).subscribe({
      next: (response) => {
        this.authService.setToken(response.accessToken);
        void this.router.navigateByUrl('/');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }
}
