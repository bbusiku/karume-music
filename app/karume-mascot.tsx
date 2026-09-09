'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  bounded, hiddenMascot, showMascot, returnMascot, holdMascot,
  dropMascot, stepMascot, mascotPose, type Bounds, type Point,
} from '@/lib/mascot';

type Props = { open: boolean; anchor: RefObject<HTMLButtonElement | null> };
const WIDTH = 104;
const HEIGHT = 124;

export default function KarumeMascot({ open, anchor }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sprite = useRef<HTMLButtonElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const motion = useRef(hiddenMascot());
  const requestedOpen = useRef(open);
  requestedOpen.current = open;

  useEffect(() => {
    const element = sprite.current;
    if (!element) return;
    let frame = 0;
    let last = performance.now();
    let wasOpen = false;
    let press: { id: number; x: number; y: number; offset: Point; timer: ReturnType<typeof setTimeout> } | null = null;
    let keyboardHeld = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const bounds = (): Bounds => ({
      left: WIDTH / 2 + 6,
      right: Math.max(WIDTH / 2 + 6, document.documentElement.clientWidth - WIDTH / 2 - 6),
      top: HEIGHT / 2 + 6,
      floor: Math.max(HEIGHT / 2 + 6, window.innerHeight - HEIGHT / 2 - 8),
    });
    const origin = (): Point => {
      const rect = anchor.current?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: bounds().right, y: bounds().floor };
    };
    const paint = () => {
      const s = motion.current;
      const pose = mascotPose(s, reduced.matches);
      element.hidden = s.mode === 'hidden';
      element.dataset.mode = s.mode;
      element.style.transform = `translate3d(${s.x - WIDTH / 2}px, ${s.y - HEIGHT / 2}px, 0) scale(${pose.scale})`;
      element.style.opacity = String(pose.opacity);
      element.style.setProperty('--pet-angle', `${pose.angle}deg`);
      element.style.setProperty('--pet-bob', `${pose.bob}px`);
      element.style.setProperty('--pet-face', String(s.direction === 1 ? -1 : 1));
      element.setAttribute('aria-pressed', String(s.mode === 'held'));
      if (shadow.current) {
        const elevation = Math.max(0, bounds().floor - s.y);
        shadow.current.hidden = s.mode === 'hidden' || s.mode === 'returning' || s.mode === 'emerging';
        shadow.current.style.transform = `translate3d(${s.x - 27}px, ${bounds().floor + HEIGHT / 2 - 5}px, 0) scale(${Math.max(0.35, 1 - elevation / 650)})`;
        shadow.current.style.opacity = String(Math.max(0.06, 0.18 - elevation / 2400));
      }
    };
    const drop = () => {
      const previous = press;
      press = null;
      keyboardHeld = false;
      if (previous) {
        clearTimeout(previous.timer);
        if (element.hasPointerCapture(previous.id)) element.releasePointerCapture(previous.id);
      }
      motion.current = dropMascot(motion.current);
      paint();
    };
    const pickUp = () => {
      motion.current = holdMascot(motion.current);
      const lifted = bounded({ x: motion.current.x, y: motion.current.y - 12 }, bounds());
      if (press) press.offset.y += motion.current.y - lifted.y;
      motion.current = { ...motion.current, ...lifted };
      paint();
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || press || !requestedOpen.current || motion.current.mode === 'hidden') return;
      event.preventDefault();
      keyboardHeld = false;
      element.focus({ preventScroll: true });
      element.setPointerCapture(event.pointerId);
      // Freeze under the finger immediately; the wiggle begins after a short hold.
      const offset = { x: event.clientX - motion.current.x, y: event.clientY - motion.current.y };
      press = {
        id: event.pointerId, x: event.clientX, y: event.clientY, offset,
        timer: setTimeout(pickUp, 160),
      };
    };
    const move = (event: PointerEvent) => {
      if (!press || press.id !== event.pointerId) return;
      event.preventDefault();
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) {
        clearTimeout(press.timer);
        if (motion.current.mode !== 'held') pickUp();
      }
      if (motion.current.mode === 'held') {
        motion.current = { ...motion.current, ...bounded({ x: event.clientX - press.offset.x, y: event.clientY - press.offset.y }, bounds()) };
        paint();
      }
    };
    const up = (event: PointerEvent) => {
      if (press?.id === event.pointerId) drop();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { drop(); return; }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (event.repeat) return;
        if (keyboardHeld) drop();
        else {
          pickUp(); keyboardHeld = true;
          motion.current = { ...motion.current, ...bounded({ x: motion.current.x, y: motion.current.y - 50 }, bounds()) };
        }
      } else if (keyboardHeld && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        motion.current = { ...motion.current, ...bounded({
          x: motion.current.x + (event.key === 'ArrowLeft' ? -18 : event.key === 'ArrowRight' ? 18 : 0),
          y: motion.current.y + (event.key === 'ArrowUp' ? -18 : event.key === 'ArrowDown' ? 18 : 0),
        }, bounds()) };
      }
      paint();
    };
    const visibility = () => { if (document.hidden) drop(); };
    const animate = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (wasOpen !== requestedOpen.current) {
        wasOpen = requestedOpen.current;
        drop();
        motion.current = wasOpen ? showMascot(motion.current, origin()) : returnMascot(motion.current);
      }
      if (motion.current.mode !== 'hidden') {
        if (!press || motion.current.mode === 'held') motion.current = stepMascot(motion.current, dt, bounds(), origin());
        paint();
      }
      frame = requestAnimationFrame(animate);
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', up);
    element.addEventListener('keydown', key);
    element.addEventListener('blur', drop);
    window.addEventListener('blur', drop);
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      drop();
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      element.removeEventListener('lostpointercapture', up);
      element.removeEventListener('keydown', key);
      element.removeEventListener('blur', drop);
      window.removeEventListener('blur', drop);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [anchor, mounted]);

  if (!mounted) return null;
  return createPortal(
    <div className="mascot-world">
      <span ref={shadow} className="mascot-shadow" hidden aria-hidden="true" />
      <button ref={sprite} className="karume-mascot" hidden type="button"
        aria-label="카루메 캐릭터 · 꾹 눌러 이동" aria-describedby="mascot-help"
        title="꾹 눌러 들어 올리고, 놓으면 내려와요" onDragStart={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}>
        <span className="mascot-wiggle"><span className="mascot-face"><img src="./karume-pop.gif" alt="" draggable={false} /></span></span>
      </button>
      <span id="mascot-help" className="sr-only">마우스나 손가락으로 꾹 누른 채 움직여 보세요. 키보드는 Enter로 들고, 방향키로 이동하고, Enter나 Escape로 내려놓을 수 있어요.</span>
    </div>, document.body,
  );
}
