import { Routes } from '@angular/router';
import { ActivitySelector } from './activity-selector/activity-selector';
import { AreaPicker } from './area-picker/area-picker';
import { authGuard } from './auth/auth.guard';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { MyPlans } from './my-plans/my-plans';
import { PlanDetail } from './plans/plan-detail/plan-detail';
import { TripDetails } from './trip-details/trip-details';

export const routes: Routes = [
  { path: '', component: AreaPicker },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'my-plans', component: MyPlans, canActivate: [authGuard] },
  { path: 'plans/:id/area', component: AreaPicker },
  { path: 'plans/:id/activities', component: ActivitySelector },
  { path: 'plans/:id/trip-details', component: TripDetails },
  { path: 'plans/:id', component: PlanDetail },
];
