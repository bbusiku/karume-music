'use client';
import { useState } from 'react';

export default function FavoriteHeart({ active, label, onToggle, className = '', identity = '' }: {
  active: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
  identity?: string;
}) {
  const [activation, setActivation] = useState({ identity, count: 0 });
  const burst = activation.identity === identity ? activation.count : 0;
  return <button type="button" className={`favorite-heart ${className}`} aria-label={label} aria-pressed={active} onClick={() => {
    if (!active) setActivation((value) => ({ identity, count: value.identity === identity ? value.count + 1 : 1 }));
    onToggle();
  }}>
    <span className="heart-stage" aria-hidden="true">
      <span key={`${identity}-${active}-${burst}`} className={`heart-glyph ${active && burst ? 'heart-pop' : ''}`}>{active ? '♥\uFE0E' : '♡'}</span>
      {active && burst > 0 && <span key={burst} className="heart-sparkles"><i>✦</i><i>✦</i><i>✦</i><i>✦</i></span>}
    </span>
  </button>;
}
