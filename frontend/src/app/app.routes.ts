import { Routes } from '@angular/router';
import { AreaPicker } from './area-picker/area-picker';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { PlanDetail } from './plans/plan-detail/plan-detail';

export const routes: Routes = [
  { path: '', component: AreaPicker },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'plans/:id', component: PlanDetail },
];
