import { TestBed } from '@angular/core/testing';
import { AreaPicker } from './area-picker';

describe('AreaPicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaPicker],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AreaPicker);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
