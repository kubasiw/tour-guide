import { Routes } from '@angular/router';
import { ActivitySelector } from './activity-selector/activity-selector';
import { AreaPicker } from './area-picker/area-picker';
import { authGuard } from './auth/auth.guard';
import { ChangePassword } from './auth/change-password/change-password';
import { ForgotPassword } from './auth/forgot-password/forgot-password';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { ResetPassword } from './auth/reset-password/reset-password';
import { MyPlans } from './my-plans/my-plans';
import { PlanDetail } from './plans/plan-detail/plan-detail';
import { PlanSummary } from './plans/plan-summary/plan-summary';
import { TripDetails } from './trip-details/trip-details';

export const routes: Routes = [
  { path: '', component: AreaPicker },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'my-plans', component: MyPlans, canActivate: [authGuard] },
  { path: 'change-password', component: ChangePassword, canActivate: [authGuard] },
  { path: 'plans/:id/area', component: AreaPicker },
  { path: 'plans/:id/activities', component: ActivitySelector },
  { path: 'plans/:id/trip-details', component: TripDetails },
  { path: 'plans/:id/summary', component: PlanSummary },
  { path: 'plans/:id', component: PlanDetail },
];
