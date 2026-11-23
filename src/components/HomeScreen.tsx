import { DECKS, type DeckId } from '../data/decks';
import { formatJapaneseTime } from '../utils/formatTime';
import type { AppRecords } from '../utils/storage';

interface HomeScreenProps {
  records: AppRecords;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSelectDeck: (deckId: DeckId) => void;
  onOpenGame: (deckId?: DeckId) => void;
}

export function HomeScreen({
  records,
  soundEnabled,
  onToggleSound,
  onSelectDeck,
  onOpenGame,
}: HomeScreenProps) {
  const clearedGameCount = DECKS.filter((d) => records.game[d.id]?.cleared).length;

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-brand">
          <div className="brand-icon" aria-hidden="true">
            1+1
          </div>
          <div>
            <h1 className="home-title">けいさんカード</h1>
            <p className="home-subtitle">しょうがく1ねんせい むけ れんしゅう＆ぼうけん</p>
          </div>
        </div>
        <button
          type="button"
          className="nav-pill sound-pill"
          onClick={onToggleSound}
          aria-label={soundEnabled ? 'おとを オフにする' : 'おとを オンにする'}
        >
          {soundEnabled ? '🔊 おとON' : '🔇 おとOFF'}
        </button>
      </header>

      <main className="home-main">
        {/* Flashcard Section */}
        <section className="home-section" aria-labelledby="section-cards">
          <div className="section-heading">
            <h2 id="section-cards" className="section-title">
              🃏 けいさんカード れんしゅう
            </h2>
            <p className="section-desc">
              まいかい ランダムに でるよ！ タイムを はかって チャレンジしよう
            </p>
          </div>

          <div className="deck-grid">
            {DECKS.map((deck) => {
              const rec = records.flashcards[deck.id];
              return (
                <button
                  key={deck.id}
                  type="button"
                  className="deck-card-btn"
                  style={
                    {
                      '--card-color': deck.color,
                      '--card-color-dark': deck.colorDark,
                      '--card-color-soft': deck.colorSoft,
                    } as React.CSSProperties
                  }
                  onClick={() => onSelectDeck(deck.id)}
                >
                  <div className="deck-card-ring" aria-hidden="true" />
                  <div className="deck-card-top">
                    <span className="deck-symbol" aria-hidden="true">
                      {deck.badgeText}
                    </span>
                    <span className="deck-count-pill">{deck.cards.length}まい</span>
                  </div>
                  <div className="deck-card-name">{deck.name}</div>
                  <div className="deck-card-sub">{deck.subtitle}</div>
                  <div className="deck-card-meta">
                    {rec ? (
                      <>
                        <span>🏆 {formatJapaneseTime(rec.bestTimeMs)}</span>
                        <span>★ {rec.clearCount}かい</span>
                      </>
                    ) : (
                      <span className="deck-card-first">タップして スタート ▶</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Game Mode Section */}
        <section className="home-section" aria-labelledby="section-game">
          <div className="game-banner">
            <div className="game-banner-pixel-art" aria-hidden="true">
              <div className="pixel-shield">⚔️</div>
            </div>
            <div className="game-banner-body">
              <span className="game-banner-badge">レトロ ぼうけん RPG</span>
              <h2 id="section-game" className="game-banner-title">
                けいさんクエスト
              </h2>
              <p className="game-banner-desc">
                もりの だんじょんを たんけんしよう！ てきや たからばこで
                けいさんバトルに かって、てんすうと かぎを あつめて ボスを たおせ！
              </p>
              <div className="game-banner-meta">
                <span>👑 クリアした しんでん：{clearedGameCount} / 4</span>
                <span>📱 スマホ・💻 パソコン りょうほう たいおう</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-game-launch"
              onClick={() => onOpenGame()}
            >
              ぼうけんに でる！ ▶
            </button>
          </div>
        </section>

        <footer className="home-footer">
          <p>
            もんだい ないよう：ちびむすドリル【大サイズ】けいさんカード（たしざん1・2／ひきざん1・2）に
            じゅんきょしています。
          </p>
        </footer>
      </main>
    </div>
  );
}
