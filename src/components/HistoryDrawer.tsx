import React from 'react';
import { History, Trash2, Clock, Cloud, FileText, X } from 'lucide-react';
import { GeneratedSpeech } from '../types';
import { STYLES } from '../data/voices';
import {
  getDefaultExportFileName,
  downloadSrtFile,
  downloadWordFile,
} from '../utils/exportFiles';

interface HistoryDrawerProps {
  history: GeneratedSpeech[];
  onSelectSpeech: (speech: GeneratedSpeech) => void;
  onLoadScript?: (speech: GeneratedSpeech) => void;
  onDeleteSpeech?: (id: string) => void;
  onClearHistory: () => void;
  activeSpeechId?: string;
  isCloudSignedIn?: boolean;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  history,
  onSelectSpeech,
  onLoadScript,
  onDeleteSpeech,
  onClearHistory,
  activeSpeechId,
  isCloudSignedIn = false,
}) => {
  if (history.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
        <p className="text-sm">មិនទាន់មានប្រវត្តិនៃការបម្លែងសំឡេងនៅឡើយទេ</p>
        <p className="text-xs text-slate-500 mt-1">
          {isCloudSignedIn
            ? 'រាល់អត្ថបទ និងប្រវត្តិដែលអ្នកបានបម្លែងនឹងត្រូវបានរក្សាទុកក្នុង Cloud ដោយស្វ័យប្រវត្តិ'
            : 'រាល់សំឡេងដែលអ្នកបានបម្លែងនឹងត្រូវបានរក្សាទុកនៅទីនេះដោយស្វ័យប្រវត្តិ'}
        </p>
      </div>
    );
  }

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diff < 60) return 'អម្បាញ់មិញ';
    if (diff < 3600) return `${Math.floor(diff / 60)} នាទីមុន`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ម៉ោងមុន`;
    return `${Math.floor(diff / 86400)} ថ្ងៃមុន`;
  };

  const handleDownload = (speech: GeneratedSpeech, format: 'mp3' | 'wav', e: React.MouseEvent) => {
    e.stopPropagation();
    const isMp3 = format === 'mp3';
    let base64Data = isMp3 ? speech.mp3Base64 : speech.wavBase64;
    let mime = isMp3 ? 'audio/mp3' : 'audio/wav';
    let ext = isMp3 ? 'mp3' : 'wav';

    // Fallback to WAV if MP3 not available
    if (isMp3 && !base64Data && speech.wavBase64) {
      base64Data = speech.wavBase64;
      mime = 'audio/wav';
      ext = 'wav';
    }

    if (!base64Data) return;

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime });
    const url = URL.createObjectURL(blob);

    const cleanSnippet = (speech.text || '')
      .replace(/\[.*?\]/g, '')
      .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, '')
      .replace(/[\n\r\t]/g, ' ')
      .trim()
      .slice(0, 32)
      .trim()
      .replace(/\s+/g, '_') || `khmer_tts_${speech.voice.toLowerCase()}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanSnippet}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = (speech: GeneratedSpeech, e: React.MouseEvent) => {
    e.stopPropagation();
    const baseName = getDefaultExportFileName(speech.text, speech.voice, speech.isDialogue);
    downloadSrtFile({
      text: speech.text,
      durationSeconds: speech.durationSeconds || 5,
      fileName: baseName,
      cues: speech.subtitleCues,
    });
  };

  const handleDownloadWord = (speech: GeneratedSpeech, e: React.MouseEvent) => {
    e.stopPropagation();
    const baseName = getDefaultExportFileName(speech.text, speech.voice, speech.isDialogue);
    const styleLabel = STYLES.find((s) => s.id === speech.style)?.labelKh || speech.style;
    void downloadWordFile({
      text: speech.text,
      fileName: baseName,
      title: baseName.replace(/_/g, ' '),
      voice: speech.voice,
      styleLabel,
      durationSeconds: speech.durationSeconds,
      isDialogue: speech.isDialogue,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
          <History className="w-4 h-4 text-indigo-400" />
          <span>ប្រវត្តិសំឡេងដែលបានបង្កើត ({history.length})</span>
          {isCloudSignedIn && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Cloud className="w-3 h-3" />
              <span>Cloud Sync</span>
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onClearHistory}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
          title="លុបប្រវត្តិទាំងអស់"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>សម្អាត</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {history.map((item) => {
          const isActive = item.id === activeSpeechId;
          const isFemale = item.gender === 'female';
          const hasAudio = Boolean(item.wavBase64 || item.mp3Base64);

          return (
            <div
              key={item.id}
              onClick={() => {
                if (hasAudio) {
                  onSelectSpeech(item);
                } else if (onLoadScript) {
                  onLoadScript(item);
                }
              }}
              className={`group p-3 rounded-xl border cursor-pointer transition-all text-left flex items-start justify-between gap-2 ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1 overflow-hidden">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                      isFemale
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {item.isDialogue ? 'សន្ទនា' : isFemale ? 'ស្រី' : 'ប្រុស'}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {item.voice}
                  </span>
                  {item.language && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 shrink-0">
                      {item.language === 'en' ? 'EN' : item.language === 'km' ? 'ខ្មែរ' : 'ខ្មែរ+EN'}
                    </span>
                  )}
                  {item.cloudSynced && (
                    <span
                      className="text-cyan-400/80 shrink-0"
                      title="បានរក្សាទុកក្នុង Cloud"
                    >
                      <Cloud className="w-3 h-3" />
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    • {formatTimeAgo(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1 font-khmer">
                  {item.text}
                </p>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                  <span>{item.durationSeconds}s</span>
                  {!hasAudio && (
                    <span className="text-amber-400/80 font-sans">
                      • អត្ថបទពី Cloud (ចុចដើម្បីផ្ទុកឡើងវិញ)
                    </span>
                  )}
                </div>
              </div>

              {/* Direct Quick Actions */}
              <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                {hasAudio ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handleDownload(item, 'mp3', e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-300 transition-colors"
                      title="ទាញយកជា MP3"
                    >
                      <span className="text-[10px] font-bold">MP3</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDownload(item, 'wav', e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600/30 text-slate-400 hover:text-amber-300 transition-colors"
                      title="ទាញយកជា WAV"
                    >
                      <span className="text-[10px] font-bold">WAV</span>
                    </button>
                  </>
                ) : (
                  onLoadScript && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadScript(item);
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1"
                      title="ផ្ទុកអត្ថបទនេះចូលក្នុងប្រអប់សរសេរឡើងវិញ"
                    >
                      <FileText className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">ផ្ទុកអត្ថបទ</span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={(e) => handleDownloadSrt(item, e)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600/30 text-slate-400 hover:text-cyan-300 transition-colors"
                  title="ទាញយកអក្សររត់ SRT"
                >
                  <span className="text-[10px] font-bold">SRT</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDownloadWord(item, e)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 transition-colors"
                  title="ទាញយកឯកសារ Word (.docx)"
                >
                  <span className="text-[10px] font-bold">DOCX</span>
                </button>

                {onDeleteSpeech && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSpeech(item.id);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-rose-600/30 text-slate-500 hover:text-rose-300 transition-colors"
                    title="លុបប្រវត្តិនេះ"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
