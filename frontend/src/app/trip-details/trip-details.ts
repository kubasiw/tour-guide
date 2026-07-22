import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  NgbAlert,
  NgbCalendar,
  NgbDate,
  NgbDateStruct,
  NgbInputDatepicker,
} from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../core/api-base-url';
import { extractErrorMessage } from '../core/http-error';
import { Plan } from '../plans/plan.model';
import { buildPlanSteps } from '../plans/plan-steps';
import { PlanService } from '../plans/plan.service';
import { AreaPreview } from '../shared/area-preview/area-preview';
import { Loader } from '../shared/loader/loader';
import { Stepper } from '../shared/stepper/stepper';

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function daysBetween(start: NgbDate, end: NgbDate): number {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

const dateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const startValue = control.get('startDate')?.value as NgbDateStruct | null | undefined;
  const endValue = control.get('endDate')?.value as NgbDateStruct | null | undefined;
  const start = NgbDate.from(startValue ?? null);
  const end = NgbDate.from(endValue ?? null);

  return !start || !end || end.after(start) ? null : { endBeforeStart: true };
};

@Component({
  selector: 'app-trip-details',
  imports: [ReactiveFormsModule, NgbAlert, Loader, Stepper, AreaPreview, NgbInputDatepicker],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.scss',
})
export class TripDetails {
  public readonly id = input.required<string>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);
  private readonly calendar = inject(NgbCalendar);

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly steps = computed(() =>
    buildPlanSteps(this.plan.value(), this.id(), 'trip-details'),
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly minDate = this.calendar.getToday();

  protected readonly form = this.formBuilder.group(
    {
      startDate: this.formBuilder.control<NgbDateStruct | null>(null, (c) =>
        c.value ? null : { required: true },
      ),
      endDate: this.formBuilder.control<NgbDateStruct | null>(null, (c) =>
        c.value ? null : { required: true },
      ),
    },
    { validators: dateRangeValidator },
  );

  public constructor() {
    effect(() => {
      const plan = this.plan.value();
      if (!plan?.startDate) {
        return;
      }

      const [year, month, day] = plan.startDate.slice(0, 10).split('-').map(Number);
      const startDate = new NgbDate(year, month, day);
      const endDate = this.calendar.getNext(startDate, 'd', plan.durationDays ?? 3);
      this.form.patchValue({ startDate, endDate });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { startDate: startValue, endDate: endValue } = this.form.getRawValue();
    const start = NgbDate.from(startValue);
    const end = NgbDate.from(endValue);
    if (!start || !end) {
      return;
    }

    const startDate = `${start.year}-${pad(start.month)}-${pad(start.day)}`;
    const durationDays = daysBetween(start, end);

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
