import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatExpression,
  shuffleCards,
  type DeckDefinition,
  type MathCard,
} from '../data/decks';
import { formatJapaneseTime, formatStopwatch } from '../utils/formatTime';
import { sound } from '../utils/sound';
import { recordFlashcardClear, type AppRecords } from '../utils/storage';
import { DeckListModal } from './DeckListModal';

type Phase = 'ready' | 'question' | 'answer' | 'finished';

interface FlashcardModeProps {
  deck: DeckDefinition;
  records: AppRecords;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRecordsChange: (records: AppRecords) => void;
  onBack: () => void;
  onPlayGameWithDeck: () => void;
}

export function FlashcardMode({
  deck,
  records,
  soundEnabled,
  onToggleSound,
  onRecordsChange,
  onBack,
  onPlayGameWithDeck,
}: FlashcardModeProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [cards, setCards] = useState<MathCard[]>(() => shuffleCards(deck.cards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const finishTimestampRef = useRef<number>(0);

  const deckRecord = records.flashcards[deck.id];
  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const isLastCard = currentIndex === totalCards - 1;

  // Reset if deck changes
  useEffect(() => {
    setPhase('ready');
    setCards(shuffleCards(deck.cards));
    setCurrentIndex(0);
    setElapsedMs(0);
    setIsNewBest(false);
    startTimeRef.current = null;
  }, [deck]);

  // Live stopwatch while playing
  useEffect(() => {
    if (phase !== 'question' && phase !== 'answer') return;
    if (startTimeRef.current === null) return;

    let rafId = 0;
    const tick = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(performance.now() - startTimeRef.current);
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase]);

  const startSession = useCallback(() => {
    const nextCards = shuffleCards(deck.cards);
    setCards(nextCards);
    setCurrentIndex(0);
    setElapsedMs(0);
    setIsNewBest(false);
    startTimeRef.current = performance.now();
    setPhase('question');
    sound.playStart();
  }, [deck.cards]);

  const handleAdvance = useCallback(() => {
    if (showListModal) return;

    if (phase === 'ready') {
      startSession();
      return;
    }

    if (phase === 'question') {
      setPhase('answer');
      sound.playReveal();
      return;
    }

    if (phase === 'answer') {
      if (currentIndex + 1 < totalCards) {
        setCurrentIndex((idx) => idx + 1);
        setPhase('question');
        sound.playNextCard();
      } else {
        const finalElapsed =
          startTimeRef.current !== null ? performance.now() - startTimeRef.current : elapsedMs;
        setElapsedMs(finalElapsed);
        startTimeRef.current = null;
        finishTimestampRef.current = performance.now();
        const result = recordFlashcardClear(deck.id, finalElapsed);
        setIsNewBest(result.isNewBest);
        onRecordsChange(result.records);
        setPhase('finished');
        sound.playFanfare();
      }
      return;
    }

    if (phase === 'finished') {
      // Brief grace period so a fast tap on the final card doesn't skip the result screen
      if (performance.now() - finishTimestampRef.current > 500) {
        startSession();
      }
    }
  }, [
    showListModal,
    phase,
    currentIndex,
    totalCards,
    elapsedMs,
    deck.id,
    onRecordsChange,
    startSession,
  ]);

  const handlePrevCard = useCallback(() => {
    if ((phase === 'question' || phase === 'answer') && currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
      setPhase('question');
      sound.playNextCard();
    }
  }, [phase, currentIndex]);

  // Global Space key listener for smooth card progression
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showListModal) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        handleAdvance();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAdvance, showListModal]);

  const progressPercent =
    phase === 'ready'
      ? 0
      : phase === 'finished'
        ? 100
        : ((currentIndex + (phase === 'answer' ? 0.5 : 0)) / totalCards) * 100;

  const avgSeconds = totalCards > 0 ? (elapsedMs / 1000 / totalCards).toFixed(1) : '0.0';

  return (
    <div
      className="flashcard-page"
      style={
        {
          '--deck-color': deck.color,
          '--deck-color-dark': deck.colorDark,
          '--deck-color-soft': deck.colorSoft,
        } as React.CSSProperties
      }
    >
      <header className="top-bar">
        <button
          type="button"
          className="nav-pill"
          onClick={(e) => {
            e.currentTarget.blur();
            onBack();
          }}
        >
          ◀ もどる
        </button>

        <div className="top-bar-center">
          <span className="deck-pill" style={{ backgroundColor: deck.color }}>
            {deck.name}
          </span>
        </div>

        <button
          type="button"
          className="nav-pill sound-pill"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleSound();
          }}
          aria-label={soundEnabled ? 'おとを オフにする' : 'おとを オンにする'}
        >
          {soundEnabled ? '🔊 おとON' : '🔇 おとOFF'}
        </button>
      </header>

      {/* Progress & Timer Strip */}
      <div className="status-strip">
        <div className="status-metrics">
          <div className="metric-box">
            <span className="metric-label">まいすう</span>
            <span className="metric-value">
              {phase === 'ready'
                ? `0 / ${totalCards}`
                : phase === 'finished'
                  ? `${totalCards} / ${totalCards}`
                  : `${currentIndex + 1} / ${totalCards}`}
            </span>
          </div>
          <div className="metric-box timer-box" aria-live="off">
            <span className="metric-label">タイム</span>
            <span className="metric-value mono-num">{formatStopwatch(elapsedMs)}</span>
          </div>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Main Stage */}
      <main className="flashcard-stage">
        {phase === 'ready' && (
          <div className="ready-panel">
            <div className="real-card real-card-cover" onClick={startSession} role="button" tabIndex={0}>
              <div className="card-ring-hole" aria-hidden="true" />
              <div className="card-cover-content">
                <span className="card-cover-tag">{deck.subtitle}</span>
                <h1 className="card-cover-title">{deck.name}</h1>
                <p className="card-cover-count">ぜんぶで {totalCards} まい（ランダム）</p>
                {deckRecord && (
                  <p className="card-cover-best">
                    🏆 ベストタイム：{formatJapaneseTime(deckRecord.bestTimeMs)}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-giant"
              onClick={(e) => {
                e.currentTarget.blur();
                startSession();
              }}
            >
              スタート！
            </button>

            <p className="hint-caption">
              クリック・タップ・スペースキーで<br className="sp-only" />
              「こたえ」→「つぎのもんだい」と すすめるよ
            </p>

            <button
              type="button"
              className="text-link-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                setShowListModal(true);
              }}
            >
              📋 このカードの もんだい いちらんを みる
            </button>
          </div>
        )}

        {(phase === 'question' || phase === 'answer') && currentCard && (
          <div className="active-card-wrap">
            <button
              type="button"
              className={`real-card real-card-active ${
                phase === 'answer' ? 'is-answer' : 'is-question'
              }`}
              onClick={(e) => {
                e.currentTarget.blur();
                handleAdvance();
              }}
              aria-label={
                phase === 'question'
                  ? `${formatExpression(currentCard)}。タップまたはスペースキーでこたえをひょうじ`
                  : `こたえ ${currentCard.answer}。タップまたはスペースキーでつぎへ`
              }
            >
              <div className="card-ring-hole" aria-hidden="true" />
              <div className="card-badge-corner">
                {phase === 'question' ? 'もんだい' : 'こたえ'}
              </div>

              {phase === 'question' ? (
                <div className="card-body">
                  <div className="card-expression">{formatExpression(currentCard)}</div>
                </div>
              ) : (
                <div className="card-body card-body-answer">
                  <div className="card-expression-small">
                    {formatExpression(currentCard)} ＝
                  </div>
                  <div className="card-answer">{currentCard.answer}</div>
                </div>
              )}

              <div className="card-tap-hint">
                {phase === 'question'
                  ? 'タップ / スペースキーで こたえを みる'
                  : isLastCard
                    ? 'タップ / スペースキーで ゴール！'
                    : 'タップ / スペースキーで つぎの もんだいへ'}
              </div>
            </button>

            <button
              type="button"
              className={`btn btn-giant ${phase === 'question' ? 'btn-primary' : 'btn-next'}`}
              onClick={(e) => {
                e.currentTarget.blur();
                handleAdvance();
              }}
            >
              {phase === 'question'
                ? 'こたえを みる'
                : isLastCard
                  ? 'ゴール！ 🎉'
                  : 'つぎの もんだい ▶'}
            </button>

            <div className="sub-controls">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={currentIndex === 0}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handlePrevCard();
                }}
              >
                ↺ まえの カード
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startSession();
                }}
              >
                🔀 シャッフルして やりなおす
              </button>
            </div>
          </div>
        )}

        {phase === 'finished' && (
          <div className="finish-panel">
            <div className="finish-confetti" aria-hidden="true">
              <span>★</span>
              <span>●</span>
              <span>★</span>
              <span>▲</span>
              <span>★</span>
            </div>

            <div className="hanamaru-badge" aria-label="はなまる">
              <span className="hanamaru-text">はなまる！</span>
            </div>

            {isNewBest && <div className="new-record-ribbon">✨ しんきろく こうしん！ ✨</div>}

            <h2 className="finish-title">
              {deck.name} {totalCards}まい クリア！
            </h2>

            <div className="finish-stats">
              <div className="stat-card stat-card-main">
                <span className="stat-label">かかった じかん</span>
                <span className="stat-value-lg">{formatJapaneseTime(elapsedMs)}</span>
                <span className="stat-sub mono-num">{formatStopwatch(elapsedMs)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">1まい あたり</span>
                <span className="stat-value">{avgSeconds}びょう</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">ベストタイム</span>
                <span className="stat-value">
                  {deckRecord ? formatJapaneseTime(deckRecord.bestTimeMs) : formatJapaneseTime(elapsedMs)}
                </span>
              </div>
            </div>

            <div className="finish-actions">
              <button
                type="button"
                className="btn btn-primary btn-giant"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startSession();
                }}
              >
                🔀 もう いっかい！（ランダム）
              </button>
              <button
                type="button"
                className="btn btn-game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPlayGameWithDeck();
                }}
              >
                ⚔️ この カードで ぼうけんゲームを する
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onBack();
                }}
              >
                ホームへ もどる
              </button>
            </div>
          </div>
        )}
      </main>

      {showListModal && (
        <DeckListModal deck={deck} onClose={() => setShowListModal(false)} />
      )}
    </div>
  );
}
