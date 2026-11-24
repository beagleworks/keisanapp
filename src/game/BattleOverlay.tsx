import { useCallback, useEffect, useRef, useState } from 'react';
import { formatExpression } from '../data/decks';
import type { BattleOutcome, BattleRequest } from './types';

interface BattleOverlayProps {
  request: BattleRequest;
  combo: number;
  onSubmitAnswer: (choice: number, speedBonus: number) => BattleOutcome;
  onComplete: () => void;
}

const SPEED_WINDOW_MS = 6000;
const MAX_SPEED_BONUS = 50;

function targetEmoji(kind: BattleRequest['targetKind']): string {
  switch (kind) {
    case 'chest':
      return '🎁';
    case 'boss':
      return '👑';
    case 'goldenSlime':
      return '✨';
    case 'octorok':
      return '🐙';
    case 'bat':
      return '🦇';
    case 'skeleton':
      return '💀';
    default:
      return '🟢';
  }
}

export function BattleOverlay({
  request,
  combo,
  onSubmitAnswer,
  onComplete,
}: BattleOverlayProps) {
  const [speedRatio, setSpeedRatio] = useState(1);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const lockedRef = useRef(false);

  // Speed bonus bar smoothly ticks down over 6 seconds (never fails on 0!)
  useEffect(() => {
    startTimeRef.current = performance.now();
    lockedRef.current = false;
    setSelectedChoice(null);
    setOutcome(null);
    setSpeedRatio(1);

    let rafId = 0;
    const tick = () => {
      if (!lockedRef.current) {
        const elapsed = performance.now() - startTimeRef.current;
        setSpeedRatio(Math.max(0, 1 - elapsed / SPEED_WINDOW_MS));
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [request]);

  const handleChoose = useCallback(
    (choice: number) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setSelectedChoice(choice);

      const elapsed = performance.now() - startTimeRef.current;
      const ratio = Math.max(0, 1 - elapsed / SPEED_WINDOW_MS);
      const speedBonus = Math.round(ratio * MAX_SPEED_BONUS);

      const res = onSubmitAnswer(choice, speedBonus);
      setOutcome(res);

      window.setTimeout(() => {
        onComplete();
      }, res.correct ? 680 : 1050);
    },
    [onSubmitAnswer, onComplete],
  );

  // Allow keyboard 1-4 to pick choices quickly on PC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (lockedRef.current) return;
      if (e.key >= '1' && e.key <= '4') {
        const idx = Number(e.key) - 1;
        if (request.choices[idx] !== undefined) {
          e.preventDefault();
          handleChoose(request.choices[idx]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request.choices, handleChoose]);

  const speedBonusNow = Math.round(speedRatio * MAX_SPEED_BONUS);

  return (
    <div className="battle-backdrop" role="dialog" aria-modal="true" aria-label="けいさんバトル">
      <div className={`battle-modal ${outcome ? (outcome.correct ? 'is-win' : 'is-miss') : ''}`}>
        <div className="battle-header">
          <div className="battle-enemy-badge">
            <span className="battle-emoji" aria-hidden="true">
              {targetEmoji(request.targetKind)}
            </span>
            <div>
              <div className="battle-target-name">{request.targetName}</div>
              <div className="battle-target-sub">
                {request.source === 'chest'
                  ? 'たからばこ クイズ！'
                  : request.targetKind === 'boss' && request.targetHp && request.targetMaxHp
                    ? `ボス HP：${'❤️'.repeat(request.targetHp)}${'🖤'.repeat(
                        request.targetMaxHp - request.targetHp,
                      )}`
                    : request.firstStrike
                      ? '⚔️ せんせいこうげき（+30てん）'
                      : '🛡️ はねかえせ！'}
              </div>
            </div>
          </div>

          {combo > 0 && <div className="battle-combo-pill">🔥 {combo}コンボ</div>}
        </div>

        {/* Speed bonus meter (never punishes, only adds bonus points) */}
        <div className="speed-meter-wrap">
          <div className="speed-meter-labels">
            <span>⚡ はやさ ボーナス</span>
            <span>+{speedBonusNow}てん</span>
          </div>
          <div className="speed-meter-track">
            <div className="speed-meter-fill" style={{ width: `${speedRatio * 100}%` }} />
          </div>
        </div>

        {/* Big Math Equation */}
        <div className="battle-question-box">
          <span className="battle-expression">{formatExpression(request.card)} ＝</span>
          <span className="battle-blank">
            {outcome ? request.card.answer : '？'}
          </span>
        </div>

        {/* 4 Big Tactile Answer Buttons */}
        <div className="battle-choices-grid">
          {request.choices.map((choice, idx) => {
            const isSelected = selectedChoice === choice;
            const isCorrectChoice = choice === request.card.answer;
            let stateClass = '';
            if (outcome) {
              if (isCorrectChoice) stateClass = 'is-correct';
              else if (isSelected) stateClass = 'is-wrong';
            }

            return (
              <button
                key={`${request.card.id}-${choice}`}
                type="button"
                className={`battle-choice-btn ${stateClass}`}
                disabled={outcome !== null}
                onClick={() => handleChoose(choice)}
              >
                <span className="choice-key-hint">{idx + 1}</span>
                <span className="choice-number">{choice}</span>
              </button>
            );
          })}
        </div>

        {/* Outcome Feedback Banner */}
        <div className="battle-feedback-slot" aria-live="polite">
          {outcome ? (
            <div className={`battle-feedback ${outcome.correct ? 'ok' : 'ng'}`}>
              {outcome.message}
            </div>
          ) : (
            <div className="battle-feedback-hint">
              こたえを タップ（または 1〜4キー）で えらぼう！
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
