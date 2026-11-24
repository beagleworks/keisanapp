import { useCallback, useState } from 'react';
import { DECKS, type DeckId } from '../data/decks';
import { formatJapaneseTime } from '../utils/formatTime';
import { recordGameResult, type AppRecords } from '../utils/storage';
import { GameCanvas, type GameEndSummary } from './GameCanvas';
import { WORLD_THEMES } from './worlds';

interface GameModeProps {
  initialDeckId: DeckId | null;
  records: AppRecords;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRecordsChange: (records: AppRecords) => void;
  onBackHome: () => void;
}

export function GameMode({
  initialDeckId,
  records,
  soundEnabled,
  onToggleSound,
  onRecordsChange,
  onBackHome,
}: GameModeProps) {
  const [selectedDeckId, setSelectedDeckId] = useState<DeckId | null>(initialDeckId);
  const [runNonce, setRunNonce] = useState(1);
  const [endSummary, setEndSummary] = useState<
    (GameEndSummary & { isNewHighScore: boolean }) | null
  >(null);

  const handleStartWorld = (deckId: DeckId) => {
    setSelectedDeckId(deckId);
    setEndSummary(null);
    setRunNonce((n) => n + 1);
  };

  const handleGameEnd = useCallback(
    (summary: GameEndSummary) => {
      const { records: nextRecords, isNewHighScore } = recordGameResult(
        summary.deckId,
        summary.score,
        summary.elapsedMs,
        summary.cleared,
      );
      onRecordsChange(nextRecords);
      setEndSummary({ ...summary, isNewHighScore });
    },
    [onRecordsChange],
  );

  const handleRetry = () => {
    setEndSummary(null);
    setRunNonce((n) => n + 1);
  };

  return (
    <div className="game-page">
      <header className="top-bar top-bar-dark">
        <button
          type="button"
          className="nav-pill nav-pill-dark"
          onClick={() => {
            if (selectedDeckId) {
              setSelectedDeckId(null);
              setEndSummary(null);
            } else {
              onBackHome();
            }
          }}
        >
          ◀ {selectedDeckId ? 'もどる' : 'ホーム'}
        </button>

        <div className="top-bar-center">
          <span className="game-header-title">⚔️ けいさんクエスト</span>
        </div>

        <button
          type="button"
          className="nav-pill nav-pill-dark sound-pill"
          onClick={onToggleSound}
        >
          {soundEnabled ? '🔊 おとON' : '🔇 おとOFF'}
        </button>
      </header>

      {!selectedDeckId ? (
        <main className="stage-select-main">
          <div className="stage-hero">
            <h1 className="stage-hero-title">どの しんでんを ぼうけん する？</h1>
            <p className="stage-hero-desc">
              てきを けんで たたいたり、たからばこを あけるときに けいさんもんだいが でるよ！
              <br />
              🗝️ かぎを みつけて、おくにいる ボスを たおそう！
            </p>
          </div>

          <div className="stage-grid">
            {DECKS.map((deck) => {
              const theme = WORLD_THEMES[deck.id];
              const rec = records.game[deck.id];
              return (
                <button
                  key={deck.id}
                  type="button"
                  className="stage-card"
                  style={
                    {
                      '--stage-bg': theme.palette.wall,
                      '--stage-accent': theme.palette.accent,
                      '--stage-ground': theme.palette.ground,
                    } as React.CSSProperties
                  }
                  onClick={() => handleStartWorld(deck.id)}
                >
                  <div className="stage-card-top">
                    <span className="stage-deck-badge" style={{ backgroundColor: deck.color }}>
                      {deck.name}
                    </span>
                    {rec?.cleared && <span className="stage-clear-crown">👑 クリアずみ</span>}
                  </div>
                  <div className="stage-card-title">{theme.worldName}</div>
                  <div className="stage-card-sub">
                    {deck.subtitle}・ボス：{theme.bossName}
                  </div>
                  <div className="stage-card-footer">
                    {rec ? (
                      <>
                        <span>💎 ハイスコア：{rec.highScore}てん</span>
                        {rec.cleared && rec.bestTimeMs > 0 && (
                          <span>⏱ {formatJapaneseTime(rec.bestTimeMs)}</span>
                        )}
                      </>
                    ) : (
                      <span>▶ タップして しゅっぱつ！</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="stage-howto-box">
            <h2>🎮 あそびかた</h2>
            <ul>
              <li>
                <strong>いどう：</strong>
                スマホは じゅうじキー、パソコンは やじるしキー（または WASD）
              </li>
              <li>
                <strong>けん・しらべる：</strong>
                「けん」ボタン（または スペースキー）で くさを かったり てきと バトル！
              </li>
              <li>
                <strong>こうりゃく：</strong>
                ひだりうえの へやで 🗝️ かぎを とって、みぎうえの ボスを 3かい せいかいで たおそう！
              </li>
            </ul>
          </div>
        </main>
      ) : (
        <main className="game-play-main">
          <GameCanvas
            deckId={selectedDeckId}
            runNonce={runNonce}
            onGameEnd={handleGameEnd}
          />
        </main>
      )}

      {/* Victory / Game Over Modal */}
      {endSummary && (
        <div className="battle-backdrop" role="dialog" aria-modal="true" aria-label="ぼうけんの けっか">
          <div className={`result-modal ${endSummary.cleared ? 'is-victory' : 'is-gameover'}`}>
            <div className="result-icon" aria-hidden="true">
              {endSummary.cleared ? '🏆' : '💫'}
            </div>
            {endSummary.isNewHighScore && endSummary.score > 0 && (
              <div className="new-record-ribbon">✨ ハイスコア こうしん！ ✨</div>
            )}
            <h2 className="result-title">
              {endSummary.cleared
                ? `${WORLD_THEMES[endSummary.deckId].worldName} クリア！`
                : 'ちからつきた…！'}
            </h2>
            <p className="result-desc">
              {endSummary.cleared
                ? `${WORLD_THEMES[endSummary.deckId].bossName}を たおして トライスターを とりもどしたよ！`
                : 'また チャレンジしよう！ いずみで ハートを かいふくできるよ！'}
            </p>

            <div className="result-stats-grid">
              <div className="result-stat result-stat-score">
                <span>スコア</span>
                <strong>{endSummary.score}てん</strong>
                {endSummary.clearBonus > 0 && (
                  <small>（クリアボーナス +{endSummary.clearBonus}てん）</small>
                )}
              </div>
              <div className="result-stat">
                <span>せいかい</span>
                <strong>{endSummary.correctCount}もん</strong>
              </div>
              <div className="result-stat">
                <span>さいだいコンボ</span>
                <strong>{endSummary.maxCombo}れんぞく</strong>
              </div>
              <div className="result-stat">
                <span>タイム</span>
                <strong>{formatJapaneseTime(endSummary.elapsedMs)}</strong>
              </div>
            </div>

            <div className="result-actions">
              <button type="button" className="btn btn-primary btn-giant" onClick={handleRetry}>
                ⚔️ もう いっかい あそぶ
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedDeckId(null);
                  setEndSummary(null);
                }}
              >
                ほかの しんでんを えらぶ
              </button>
              <button type="button" className="btn btn-ghost-dark" onClick={onBackHome}>
                ホームへ もどる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
