import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, ArrowRightLeft } from 'lucide-react';
import { DialogueTurn, DialogueCharacterId, SpeechLanguage } from '../types';
import { SAMPLE_DIALOGUES, DIALOGUE_CHARACTERS } from '../data/voices';

interface DialogueModeProps {
  language: SpeechLanguage;
  onGenerateDialogue: (
    turns: DialogueTurn[],
    maleVoice: string,
    femaleVoice: string
  ) => void;
  isLoading: boolean;
}

export const DialogueMode: React.FC<DialogueModeProps> = ({
  language,
  onGenerateDialogue,
  isLoading,
}) => {
  const [turns, setTurns] = useState<DialogueTurn[]>([
    { id: '1', speaker: 'ប្រុស', text: '' },
    { id: '2', speaker: 'ស្រី', text: '' },
  ]);
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState<number | null>(null);

  // Character voice overrides (default mappings)
  const [voiceMap, setVoiceMap] = useState<Record<string, string>>({
    'ក្មេងប្រុស': 'Puck',
    'ក្មេងស្រី': 'Zephyr',
    'មនុស្សចាស់ប្រុស': 'Charon',
    'មនុស្សចាស់ស្រី': 'Kore',
    'ប្រុស': 'Fenrir',
    'ស្រី': 'Kore',
    'ពិធីករ Podcast': 'Aoede',
    'អ្នកវិភាគ': 'Orus',
  });

  const getCharacter = (id: string) => {
    return DIALOGUE_CHARACTERS.find((c) => c.id === id) || DIALOGUE_CHARACTERS[0];
  };

  const addTurn = () => {
    const lastTurn = turns[turns.length - 1];
    let nextSpeaker: DialogueCharacterId = 'ក្មេងប្រុស';
    if (lastTurn) {
      if (lastTurn.speaker === 'មនុស្សចាស់ប្រុស') nextSpeaker = 'ក្មេងប្រុស';
      else if (lastTurn.speaker === 'ក្មេងប្រុស') nextSpeaker = 'ក្មេងស្រី';
      else if (lastTurn.speaker === 'ក្មេងស្រី') nextSpeaker = 'មនុស្សចាស់ប្រុស';
      else if (lastTurn.speaker === 'ពិធីករ Podcast') nextSpeaker = 'អ្នកវិភាគ';
      else if (lastTurn.speaker === 'អ្នកវិភាគ') nextSpeaker = 'ពិធីករ Podcast';
      else if (lastTurn.speaker === 'ប្រុស') nextSpeaker = 'ស្រី';
      else nextSpeaker = 'ប្រុស';
    }

    setTurns([
      ...turns,
      {
        id: Date.now().toString(),
        speaker: nextSpeaker,
        text: '',
      },
    ]);
  };

  const updateTurnText = (index: number, text: string) => {
    const nextTurns = [...turns];
    nextTurns[index].text = text;
    setTurns(nextTurns);
  };

  const setSpeakerForTurn = (index: number, speaker: DialogueCharacterId) => {
    const nextTurns = [...turns];
    nextTurns[index].speaker = speaker;
    setTurns(nextTurns);
    setActiveSpeakerIndex(null);
  };

  const cycleSpeaker = (index: number) => {
    const currentSpeaker = turns[index].speaker;
    const currentIndex = DIALOGUE_CHARACTERS.findIndex((c) => c.id === currentSpeaker);
    const nextIndex = (currentIndex + 1) % DIALOGUE_CHARACTERS.length;
    setSpeakerForTurn(index, DIALOGUE_CHARACTERS[nextIndex].id);
  };

  const removeTurn = (index: number) => {
    if (turns.length <= 1) return;
    setTurns(turns.filter((_, i) => i !== index));
  };

  const loadPreset = (presetIndex: number) => {
    setTurns(SAMPLE_DIALOGUES[presetIndex].turns);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validTurns = turns.filter((t) => t.text.trim().length > 0);
    if (validTurns.length === 0) {
      alert('សូមបញ្ចូលអត្ថបទសន្ទនាយ៉ាងហោចណាស់មួយឃ្លា');
      return;
    }

    // Attach mapped voices to turns
    const enrichedTurns = validTurns.map((turn) => ({
      ...turn,
      voice: voiceMap[turn.speaker] || getCharacter(turn.speaker).defaultVoice,
    }));

    onGenerateDialogue(
      enrichedTurns,
      voiceMap['ប្រុស'] || 'Fenrir',
      voiceMap['ស្រី'] || 'Kore'
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Character Roles Showcase Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎭</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              តួអង្គកិច្ចសន្ទនា Podcast &amp; អ្នកវិភាគ (8 Character Roles)
            </span>
          </div>
          <span className="text-[11px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            មានកុមារ មនុស្សចាស់ Podcast &amp; អ្នកវិភាគ
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIALOGUE_CHARACTERS.map((char) => {
            const isAssignedInTurns = turns.some((t) => t.speaker === char.id);
            return (
              <div
                key={char.id}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isAssignedInTurns
                    ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20'
                    : 'border-slate-800 bg-slate-950/60 opacity-80'
                }`}
              >
                <div className="text-xl mb-1">{char.icon}</div>
                <div className="text-xs font-semibold text-slate-200 truncate">{char.labelKh.split(' (')[0]}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">សំឡេង: {voiceMap[char.id] || char.defaultVoice}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset Dialogues */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 font-medium">គំរូកិច្ចសន្ទនា:</span>
        {SAMPLE_DIALOGUES.map((preset, idx) => (
          <button
            key={preset.title}
            type="button"
            onClick={() => loadPreset(idx)}
            className={`px-3 py-1.5 text-xs rounded-xl border transition-colors shadow-sm ${
              preset.language === language
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
            }`}
          >
            {preset.title.split(' (')[0]}
          </button>
        ))}
      </div>

      {/* Dialogue Turns */}
      <div className="space-y-3">
        {turns.map((turn, index) => {
          const char = getCharacter(turn.speaker);
          const isDropdownOpen = activeSpeakerIndex === index;

          return (
            <div
              key={turn.id || index}
              className={`p-3 sm:p-4 rounded-2xl border transition-all space-y-3 ${char.bgClass} border-slate-800/80 hover:border-slate-700/80 shadow-md`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                {/* Speaker Selector */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSpeakerIndex(isDropdownOpen ? null : index)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${char.colorClass}`}
                      title="ចុចដើម្បីជ្រើសរើសតួអង្គ (Select Character)"
                    >
                      <span className="text-base">{char.icon}</span>
                      <span>{char.labelKh.split(' (')[0]}</span>
                      <span className="text-[10px] opacity-70 ml-0.5">▼</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cycleSpeaker(index)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 text-xs transition-colors"
                      title="ប្តូរតួអង្គបន្ទាប់ដោយស្វ័យប្រវត្តិ"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Character Pick Dropdown */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 px-2 py-1">
                        ជ្រើសរើសតួអង្គនិយាយ៖
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {DIALOGUE_CHARACTERS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSpeakerForTurn(index, c.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                              turn.speaker === c.id
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                                : 'text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{c.icon}</span>
                              <span>{c.labelKh}</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                              {c.badge}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 self-end sm:self-center">
                  <span className="text-[11px] text-slate-400">ឃ្លាទី {index + 1}</span>
                  {turns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTurn(index)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="លុបឃ្លានេះ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Text Input */}
              <div className="w-full">
                <textarea
                  rows={2}
                  value={turn.text}
                  onChange={(e) => updateTurnText(index, e.target.value)}
                  placeholder={
                    language === 'en'
                      ? `Type dialogue in English for ${char.nameEn}...`
                      : `បញ្ចូលសម្តីរបស់ ${char.labelKh.split(' (')[0]} នៅទីនេះ (ខ្មែរ ឬ English)...`
                  }
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y leading-relaxed"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Turn & Submit */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={addTurn}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-800 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>បន្ថែមឃ្លាសន្ទនាថ្មី</span>
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              <span>កំពុងបង្កើតសំឡេងសន្ទនា...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>បម្លែងកិច្ចសន្ទនាទៅជាសំឡេង (Generate Dialogue)</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
