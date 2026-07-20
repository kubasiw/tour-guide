import { Component, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { extractErrorMessage } from '../core/http-error';
import { PlanService } from '../plans/plan.service';
import { Loader } from '../shared/loader/loader';

@Component({
  selector: 'app-trip-details',
  imports: [ReactiveFormsModule, NgbAlert, Loader],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.scss',
})
export class TripDetails {
  public readonly id = input.required<string>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly form = this.formBuilder.nonNullable.group({
    startDate: ['', [(c: AbstractControl) => Validators.required(c)]],
    durationDays: [
      3,
      [
        (c: AbstractControl) => Validators.required(c),
        (c: AbstractControl) => Validators.min(1)(c),
        (c: AbstractControl) => Validators.max(30)(c),
      ],
    ],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { startDate, durationDays } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.planService.update(this.id(), { startDate, durationDays }).subscribe({
      next: (plan) => {
        void this.router.navigate(['/plans', plan.id]);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }
}
