import { useCallback, useState } from 'react';
import type { GameStageId } from '../data/decks';
import {
  getClearedStageCount,
  getTotalGameHighScore,
  recordGameResult,
  resetGameRecords,
  type AppRecords,
  type ScoreRank,
} from '../utils/storage';
import { GameCanvas, type GameEndSummary } from './GameCanvas';
import { WORLD_THEME_LIST, WORLD_THEMES } from './worlds';

interface GameModeProps {
  initialStageId: GameStageId | null;
  records: AppRecords;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRecordsChange: (records: AppRecords) => void;
  onBackHome: () => void;
}

export function GameMode({
  initialStageId,
  records,
  soundEnabled,
  onToggleSound,
  onRecordsChange,
  onBackHome,
}: GameModeProps) {
  const [selectedStageId, setSelectedStageId] = useState<GameStageId | null>(initialStageId);
  const [runNonce, setRunNonce] = useState(1);
  const [showResetModal, setShowResetModal] = useState(false);
  const [endSummary, setEndSummary] = useState<
    (GameEndSummary & { isNewHighScore: boolean; rank: ScoreRank }) | null
  >(null);

  const totalHighScore = getTotalGameHighScore(records);
  const clearedCount = getClearedStageCount(records);
  const hasAnyGameRecord = Object.keys(records.game).length > 0;

  const handleStartWorld = (stageId: GameStageId) => {
    setSelectedStageId(stageId);
    setEndSummary(null);
    setRunNonce((n) => n + 1);
  };

  const handleGameEnd = useCallback(
    (summary: GameEndSummary) => {
      const { records: nextRecords, isNewHighScore, rank } = recordGameResult(
        summary.stageId,
        summary.score,
        summary.cleared,
      );
      onRecordsChange(nextRecords);
      setEndSummary({ ...summary, isNewHighScore, rank });
    },
    [onRecordsChange],
  );

  const handleRetry = () => {
    setEndSummary(null);
    setRunNonce((n) => n + 1);
  };

  const handleConfirmReset = () => {
    const next = resetGameRecords();
    onRecordsChange(next);
    setShowResetModal(false);
  };

  return (
    <div className="game-page">
      <header className="top-bar top-bar-dark">
        <button
          type="button"
          className="nav-pill nav-pill-dark"
          onClick={() => {
            if (selectedStageId) {
              setSelectedStageId(null);
              setEndSummary(null);
            } else {
              onBackHome();
            }
          }}
        >
          ◀ {selectedStageId ? 'もどる' : 'ホーム'}
        </button>

        <div className="top-bar-center">
          <span className="game-header-title">⚔️ けいさんクエスト</span>
        </div>

        <div className="top-bar-actions">
          {selectedStageId && !endSummary && (
            <button
              type="button"
              className="nav-pill nav-pill-dark"
              onClick={handleRetry}
              title="あたらしい ランダムマップで やりなおす"
              aria-label="あたらしい ランダムマップで やりなおす"
            >
              🎲<span className="hide-xs"> やりなおす</span>
            </button>
          )}
          <button
            type="button"
            className="nav-pill nav-pill-dark sound-pill"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'おとを オフにする' : 'おとを オンにする'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </header>

      {!selectedStageId ? (
        <main className="stage-select-main">
          <div className="stage-hero">
            <h1 className="stage-hero-title">どの しんでんを ぼうけん する？</h1>
            <p className="stage-hero-desc">
              まいかい マップと ルートが かわるよ！ てきや たからばこを ぜんぶ さがして、
              ハイスコアと Sランクを めざそう！
            </p>
            <div className="stage-summary-strip">
              <div className="summary-chip">
                <span>💎 ごうけい ハイスコア</span>
                <strong className="mono-num">{totalHighScore}てん</strong>
              </div>
              <div className="summary-chip">
                <span>👑 クリア</span>
                <strong>
                  {clearedCount} / {WORLD_THEME_LIST.length}
                </strong>
              </div>
            </div>
          </div>

          <div className="stage-grid">
            {WORLD_THEME_LIST.map((theme) => {
              const rec = records.game[theme.stageId];
              const isMixed = theme.stageId === 'mixed';
              return (
                <button
                  key={theme.stageId}
                  type="button"
                  className={`stage-card ${isMixed ? 'stage-card-featured' : ''}`}
                  style={
                    {
                      '--stage-bg': theme.palette.wall,
                      '--stage-accent': theme.palette.accent,
                      '--stage-ground': theme.palette.ground,
                    } as React.CSSProperties
                  }
                  onClick={() => handleStartWorld(theme.stageId)}
                >
                  <div className="stage-card-top">
                    <span
                      className="stage-deck-badge"
                      style={{ backgroundColor: theme.badgeColor }}
                    >
                      {theme.badgeName}
                    </span>
                    <div className="stage-card-badges">
                      {rec?.bestRank && (
                        <span className={`rank-pill rank-${rec.bestRank.toLowerCase()}`}>
                          {rec.bestRank}ランク
                        </span>
                      )}
                      {rec?.cleared && <span className="stage-clear-crown">👑 クリア</span>}
                    </div>
                  </div>
                  <div className="stage-card-title">{theme.worldName}</div>
                  <div className="stage-card-sub">
                    {theme.subtitle}・ボス：{theme.bossName}
                  </div>
                  <div className="stage-card-footer">
                    {rec ? (
                      <>
                        <span className="mono-num">💎 ハイスコア：{rec.highScore}てん</span>
                        {rec.clearCount > 0 && <span>★ {rec.clearCount}かいクリア</span>}
                      </>
                    ) : (
                      <span>🎲 タップして ランダムだんじょんへ！ ▶</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="stage-howto-box">
            <h2>🎮 ハイスコアの コツ</h2>
            <ul>
              <li>
                <strong>ランダムダンジョン：</strong>
                あそぶたびに へやの つながり・たからばこ・ボスの ばしょが かわるよ！
              </li>
              <li>
                <strong>ボーナスてん：</strong>
                れんぞくせいかいコンボ、せんせいこうげき、レアな「ゴールデンスライム」、
                たからばこコンプ＆ノーミスで だいボーナス！
              </li>
              <li>
                <strong>そうさ：</strong>
                スマホは じゅうじキー＆「けん」、パソコンは やじるし（WASD）＆スペースキー
              </li>
            </ul>
          </div>

          <div className="reset-progress-bar">
            <button
              type="button"
              className="btn-reset-progress"
              disabled={!hasAnyGameRecord}
              onClick={() => setShowResetModal(true)}
            >
              🗑️ ゲームの しんちょく・ハイスコアを リセットする
            </button>
          </div>
        </main>
      ) : (
        <main className="game-play-main">
          <GameCanvas
            stageId={selectedStageId}
            stageHighScore={records.game[selectedStageId]?.highScore ?? 0}
            runNonce={runNonce}
            onGameEnd={handleGameEnd}
          />
        </main>
      )}

      {/* Reset Progress Confirmation Modal */}
      {showResetModal && (
        <div
          className="battle-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="しんちょくリセットの かくにん"
          onClick={() => setShowResetModal(false)}
        >
          <div className="result-modal is-gameover" onClick={(e) => e.stopPropagation()}>
            <div className="result-icon" aria-hidden="true">
              🗑️
            </div>
            <h2 className="result-title">ゲームの きろくを リセット する？</h2>
            <p className="result-desc">
              1〜5めんの ハイスコア・ランク・クリアきろくが すべて さいしょに もどります。
              <br />
              （けいさんカードの ベストタイムは そのまま のこるよ）
            </p>
            <div className="result-actions">
              <button
                type="button"
                className="btn btn-danger btn-giant"
                onClick={handleConfirmReset}
              >
                リセットする
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-giant"
                onClick={() => setShowResetModal(false)}
              >
                やめる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {endSummary && (
        <div className="battle-backdrop" role="dialog" aria-modal="true" aria-label="ぼうけんの けっか">
          <div className={`result-modal ${endSummary.cleared ? 'is-victory' : 'is-gameover'}`}>
            <div className="result-top-visual">
              <span className="result-icon" aria-hidden="true">
                {endSummary.cleared ? '🏆' : '💫'}
              </span>
              {endSummary.cleared && (
                <span className={`result-rank-badge rank-${endSummary.rank.toLowerCase()}`}>
                  {endSummary.rank}ランク
                </span>
              )}
            </div>

            {endSummary.isNewHighScore && endSummary.score > 0 && (
              <div className="new-record-ribbon">✨ ハイスコア こうしん！ ✨</div>
            )}

            <h2 className="result-title">
              {endSummary.cleared
                ? `${WORLD_THEMES[endSummary.stageId].worldName} クリア！`
                : 'ちからつきた…！'}
            </h2>
            <p className="result-desc">
              {endSummary.cleared
                ? `${WORLD_THEMES[endSummary.stageId].bossName}を たおして トライスターを とりもどしたよ！`
                : 'また チャレンジしよう！ いずみで ハートを かいふくできるよ！'}
            </p>

            <div className="result-stats-grid">
              <div className="result-stat result-stat-score">
                <span>こんかいの スコア</span>
                <strong className="mono-num">{endSummary.score}てん</strong>
                <small className="mono-num">
                  🏆 ハイスコア：{records.game[endSummary.stageId]?.highScore ?? endSummary.score}てん
                </small>
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
                <span>のこりライフ</span>
                <strong>♥ {endSummary.heartsLeft}</strong>
              </div>
            </div>

            {endSummary.bonusBreakdown && (
              <div className="bonus-breakdown-box">
                <div className="bonus-chip">クリア +{endSummary.bonusBreakdown.stageClear}</div>
                {endSummary.bonusBreakdown.lifeBonus > 0 && (
                  <div className="bonus-chip">
                    ライフ +{endSummary.bonusBreakdown.lifeBonus}
                  </div>
                )}
                {endSummary.bonusBreakdown.noMissBonus > 0 && (
                  <div className="bonus-chip bonus-chip-gold">
                    ノーミス +{endSummary.bonusBreakdown.noMissBonus}
                  </div>
                )}
                {endSummary.bonusBreakdown.allChestsBonus > 0 && (
                  <div className="bonus-chip bonus-chip-gold">
                    たからばこコンプ +{endSummary.bonusBreakdown.allChestsBonus}
                  </div>
                )}
                {endSummary.bonusBreakdown.allEnemiesBonus > 0 && (
                  <div className="bonus-chip bonus-chip-gold">
                    てきぜんめつ +{endSummary.bonusBreakdown.allEnemiesBonus}
                  </div>
                )}
              </div>
            )}

            <div className="result-actions">
              <button type="button" className="btn btn-primary btn-giant" onClick={handleRetry}>
                🎲 あたらしい マップで もう いっかい！
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedStageId(null);
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
