export type Point = { x: number; y: number };
export type Bounds = { left: number; right: number; top: number; floor: number };
export type MascotMode = 'hidden' | 'emerging' | 'falling' | 'walking' | 'held' | 'returning';
export type Mascot = Point & {
  mode: MascotMode;
  from: Point;
  elapsed: number;
  vx: number;
  vy: number;
  direction: 1 | -1;
  bounces: number;
};
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const bounded = (p: Point, b: Bounds): Point => ({
  x: clamp(p.x, b.left, b.right),
  y: clamp(p.y, b.top, b.floor),
});
export const hiddenMascot = (): Mascot => ({
  mode: 'hidden', x: 0, y: 0, from: { x: 0, y: 0 }, elapsed: 0,
  vx: 0, vy: 0, direction: -1, bounces: 0,
});
export function showMascot(s: Mascot, anchor: Point): Mascot {
  // Reopening during the return keeps the current position without teleporting.
  if (s.mode !== 'hidden') return { ...s, mode: 'falling', elapsed: 0, vy: -110, bounces: 0 };
  return { ...hiddenMascot(), ...anchor, from: anchor, mode: 'emerging' };
}
export function returnMascot(s: Mascot): Mascot {
  return s.mode === 'hidden' ? s : { ...s, mode: 'returning', from: { x: s.x, y: s.y }, elapsed: 0 };
}
export function holdMascot(s: Mascot): Mascot {
  if (s.mode === 'hidden' || s.mode === 'returning') return s;
  return { ...s, mode: 'held', elapsed: 0, vx: 0, vy: 0 };
}
export function dropMascot(s: Mascot): Mascot {
  return s.mode !== 'held' ? s : { ...s, mode: 'falling', elapsed: 0, vx: 14 * s.direction, vy: 0, bounces: 0 };
}
export function stepMascot(s: Mascot, seconds: number, b: Bounds, anchor: Point): Mascot {
  if (s.mode === 'hidden') return s;
  // A suspended tab resumes gently instead of simulating a giant fall.
  const dt = clamp(seconds, 0, 0.04);
  const n = { ...s, elapsed: s.elapsed + dt };
  if (s.mode === 'emerging') {
    const t = Math.min(1, n.elapsed / 0.58);
    const end = bounded({ x: s.from.x - 62, y: s.from.y - 94 }, b);
    const ease = 1 - (1 - t) ** 3;
    n.x = s.from.x + (end.x - s.from.x) * ease;
    n.y = s.from.y + (end.y - s.from.y) * ease - Math.sin(t * Math.PI) * 32;
    if (t === 1) Object.assign(n, { mode: 'falling', elapsed: 0, vx: -26, vy: -40 });
  } else if (s.mode === 'returning') {
    const t = Math.min(1, n.elapsed / 0.88);
    const ease = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const controlY = Math.max(b.top, Math.min(s.from.y, anchor.y) - 115);
    n.x = s.from.x + (anchor.x - s.from.x) * ease;
    n.y = (1 - ease) ** 2 * s.from.y + 2 * (1 - ease) * ease * controlY + ease ** 2 * anchor.y;
    if (t === 1) n.mode = 'hidden';
  } else if (s.mode === 'falling') {
    n.vy += 1150 * dt;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.y >= b.floor) {
      n.y = b.floor;
      if (n.vy > 100 && n.bounces < 2) {
        n.vy = -n.vy * 0.34;
        n.bounces += 1;
      } else Object.assign(n, { mode: 'walking', elapsed: 0, vx: 0, vy: 0 });
    }
    if (n.y < b.top) { n.y = b.top; n.vy = Math.max(0, n.vy); }
    if (n.x < b.left || n.x > b.right) { n.vx *= -1; n.direction = n.x < b.left ? 1 : -1; }
    n.x = clamp(n.x, b.left, b.right);
  } else if (s.mode === 'walking') {
    // Short rests between little steps make the walk feel less mechanical.
    const resting = n.elapsed % 6.8 > 5.5;
    n.x += resting ? 0 : n.direction * 27 * dt;
    n.y = b.floor;
    if (n.x <= b.left || n.x >= b.right) n.direction = n.x <= b.left ? 1 : -1;
    n.x = clamp(n.x, b.left, b.right);
  } else if (s.mode === 'held') Object.assign(n, bounded(n, b));
  return n;
}
export function mascotPose(s: Mascot, reduced = false) {
  let scale = 1, angle = 0, bob = 0, opacity = 1;
  if (s.mode === 'emerging') {
    const t = Math.min(1, s.elapsed / 0.58);
    scale = t < 0.6 ? 0.06 + (t / 0.6) * 1.06 : 1 + 0.12 * Math.cos(((t - 0.6) / 0.4) * Math.PI / 2);
    angle = reduced ? 0 : Math.sin(t * Math.PI) * -12;
  } else if (s.mode === 'returning') {
    const t = Math.min(1, s.elapsed / 0.88);
    scale = 1 - 0.97 * clamp((t - 0.42) / 0.58, 0, 1);
    opacity = 1 - clamp((t - 0.83) / 0.17, 0, 1);
    angle = reduced ? 0 : Math.sin(t * Math.PI) * 13;
  } else if (s.mode === 'walking' && s.elapsed % 6.8 <= 5.5 && !reduced) {
    bob = -Math.abs(Math.sin(s.elapsed * 9)) * 3;
    angle = Math.sin(s.elapsed * 9) * 3;
  } else if (s.mode === 'held' && !reduced) {
    angle = Math.sin(s.elapsed * 32) * 7;
    bob = Math.sin(s.elapsed * 25) * 2;
  }
  return { scale, angle, bob, opacity };
}
