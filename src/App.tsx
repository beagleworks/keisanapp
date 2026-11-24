import { useCallback, useEffect, useState } from 'react';
import { FlashcardMode } from './components/FlashcardMode';
import { HomeScreen } from './components/HomeScreen';
import { DECK_MAP, type DeckId } from './data/decks';
import { GameMode } from './game/GameMode';
import { sound } from './utils/sound';
import { loadRecords, saveSoundEnabled, type AppRecords } from './utils/storage';

type AppView =
  | { kind: 'home' }
  | { kind: 'flashcard'; deckId: DeckId }
  | { kind: 'game'; deckId: DeckId | null };

export function App() {
  const [view, setView] = useState<AppView>({ kind: 'home' });
  const [records, setRecords] = useState<AppRecords>(() => loadRecords());

  useEffect(() => {
    sound.setEnabled(records.soundEnabled);
  }, [records.soundEnabled]);

  const handleToggleSound = useCallback(() => {
    setRecords((prev) => {
      const nextEnabled = !prev.soundEnabled;
      sound.setEnabled(nextEnabled);
      saveSoundEnabled(nextEnabled);
      if (nextEnabled) {
        sound.playNextCard();
      }
      return { ...prev, soundEnabled: nextEnabled };
    });
  }, []);

  if (view.kind === 'flashcard') {
    const deck = DECK_MAP[view.deckId];
    return (
      <FlashcardMode
        deck={deck}
        records={records}
        soundEnabled={records.soundEnabled}
        onToggleSound={handleToggleSound}
        onRecordsChange={setRecords}
        onBack={() => setView({ kind: 'home' })}
        onPlayGameWithDeck={() => setView({ kind: 'game', deckId: deck.id })}
      />
    );
  }

  if (view.kind === 'game') {
    return (
      <GameMode
        initialDeckId={view.deckId}
        records={records}
        soundEnabled={records.soundEnabled}
        onToggleSound={handleToggleSound}
        onRecordsChange={setRecords}
        onBackHome={() => setView({ kind: 'home' })}
      />
    );
  }

  return (
    <HomeScreen
      records={records}
      soundEnabled={records.soundEnabled}
      onToggleSound={handleToggleSound}
      onSelectDeck={(deckId) => setView({ kind: 'flashcard', deckId })}
      onOpenGame={(deckId) => setView({ kind: 'game', deckId: deckId ?? null })}
    />
  );
}

export default App;
