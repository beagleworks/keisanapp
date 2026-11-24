import { useCallback, useRef } from 'react';
import type { Direction } from './types';

interface TouchControlsProps {
  activeDir: Direction | null;
  onDirChange: (dir: Direction | null) => void;
  onAttack: () => void;
  hasFlameSword: boolean;
}

export function TouchControls({
  activeDir,
  onDirChange,
  onAttack,
  hasFlameSword,
}: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const computeDirFromPoint = useCallback((clientX: number, clientY: number): Direction | null => {
    const el = padRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    if (Math.hypot(dx, dy) < 12) return null;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }, []);

  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    onDirChange(computeDirFromPoint(e.clientX, e.clientY));
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    onDirChange(computeDirFromPoint(e.clientX, e.clientY));
  };

  const handlePadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    pointerIdRef.current = null;
    onDirChange(null);
  };

  return (
    <div className="touch-controls" aria-label="ゲーム そうさパネル">
      <div
        ref={padRef}
        className="dpad"
        onPointerDown={handlePadPointerDown}
        onPointerMove={handlePadPointerMove}
        onPointerUp={handlePadPointerUp}
        onPointerCancel={handlePadPointerUp}
      >
        <div className={`dpad-arm dpad-up ${activeDir === 'up' ? 'is-active' : ''}`}>▲</div>
        <div className={`dpad-arm dpad-left ${activeDir === 'left' ? 'is-active' : ''}`}>◀</div>
        <div className="dpad-center" />
        <div className={`dpad-arm dpad-right ${activeDir === 'right' ? 'is-active' : ''}`}>▶</div>
        <div className={`dpad-arm dpad-down ${activeDir === 'down' ? 'is-active' : ''}`}>▼</div>
      </div>

      <div className="touch-hint-center">
        <span className="pc-keys-hint">
          PC：やじるし / WASD で いどう
          <br />
          スペース で けん・しらべる
        </span>
      </div>

      <button
        type="button"
        className={`attack-pad-btn ${hasFlameSword ? 'is-flame' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          onAttack();
        }}
        onClick={(e) => {
          // Allow keyboard/assistive activation while avoiding double-trigger on pointer
          if (e.detail === 0) onAttack();
        }}
        aria-label="けんを ふる・しらべる"
      >
        <span className="attack-pad-icon">{hasFlameSword ? '🔥' : '⚔️'}</span>
        <span className="attack-pad-label">けん</span>
      </button>
    </div>
  );
}
