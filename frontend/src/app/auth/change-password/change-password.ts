import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { Loader } from '../../shared/loader/loader';

const passwordsMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const newPassword = control.get('newPassword')?.value as string | undefined;
  const confirmPassword = control.get('confirmPassword')?.value as string | undefined;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { passwordsMismatch: true }
    : null;
};

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, RouterLink, NgbAlert, Loader],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', [(c: AbstractControl) => Validators.required(c)]],
      newPassword: ['', [(c: AbstractControl) => Validators.required(c), Validators.minLength(8)]],
      confirmPassword: ['', [(c: AbstractControl) => Validators.required(c)]],
    },
    { validators: passwordsMatchValidator },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set('Hasło zostało zmienione.');
        this.form.reset();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }
}
