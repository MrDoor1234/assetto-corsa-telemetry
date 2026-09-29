import { describe, it, expect } from 'vitest';

describe('Race Telemetry Math & Formatting Utilities', () => {
  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  it('formats valid lap time milliseconds correctly', () => {
    expect(formatLapTime(78450)).toBe('1:18.450');
    expect(formatLapTime(65005)).toBe('1:05.005');
    expect(formatLapTime(120999)).toBe('2:00.999');
  });

  it('handles invalid or zero lap time gracefully', () => {
    expect(formatLapTime(0)).toBe('--:--.---');
    expect(formatLapTime(-500)).toBe('--:--.---');
  });

  it('converts km/h to mph accurately', () => {
    const kmh = 300.0;
    const mph = kmh * 0.621371;
    expect(Math.round(mph * 10) / 10).toBe(186.4);
  });

  it('computes resultant 2D G-force correctly', () => {
    const sway = 3.0; // 3G lateral
    const surge = 4.0; // 4G braking
    const totalG = Math.sqrt(sway * sway + surge * surge);
    expect(totalG).toBe(5.0);
  });

  it('converts wheel camber radians to degrees', () => {
    const camberRad = -0.052;
    const camberDeg = Number((camberRad * (180 / Math.PI)).toFixed(1));
    expect(camberDeg).toBe(-3.0);
  });

  it('calculates RPM redline percentages and shift alert threshold', () => {
    const maxRpm = 13500;
    const rpmNormal = 10000;
    const rpmRedline = 13000;

    const pctNormal = (rpmNormal / maxRpm) * 100;
    const pctRedline = (rpmRedline / maxRpm) * 100;

    expect(pctNormal < 95).toBe(true);
    expect(pctRedline >= 95).toBe(true);
  });

  it('calculates live lap delta progression accurately', () => {
    const bestLapMs = 80000;
    const carPos = 0.5; // halfway through lap
    const currentLapMs = 39500; // 500ms faster than expected 40,000ms

    const expectedAtPos = bestLapMs * carPos;
    const deltaSec = (currentLapMs - expectedAtPos) / 1000;
    expect(deltaSec).toBe(-0.5);
  });
});
