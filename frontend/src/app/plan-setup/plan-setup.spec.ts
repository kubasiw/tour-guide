import { TestBed } from '@angular/core/testing';
import { PlanSetup } from './plan-setup';

describe('PlanSetup', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanSetup],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlanSetup);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
