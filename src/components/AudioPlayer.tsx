import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Music,
  Check,
  Share2,
  Edit3,
  FileAudio,
  Captions,
  FileText,
} from 'lucide-react';
import { GeneratedSpeech } from '../types';
import { STYLES } from '../data/voices';
import {
  sanitizeFileName,
  getDefaultExportFileName,
  downloadSrtFile,
  downloadWordFile,
} from '../utils/exportFiles';

function getDefaultFileName(speech: GeneratedSpeech): string {
  return getDefaultExportFileName(speech.text, speech.voice, speech.isDialogue);
}

interface AudioPlayerProps {
  speech: GeneratedSpeech;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ speech, autoPlay = true }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(speech.durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string>(() => getDefaultFileName(speech));

  useEffect(() => {
    setCustomFileName(getDefaultFileName(speech));
  }, [speech.id]);

  // Audio source (prefer MP3 for browser playback compatibility, fallback to WAV)
  const audioSource = speech.mp3Base64
    ? `data:audio/mp3;base64,${speech.mp3Base64}`
    : `data:audio/wav;base64,${speech.wavBase64}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = audioSource;
    audio.load();
    setCurrentTime(0);

    if (autoPlay) {
      audio.play().catch(() => {
        // Autoplay may be blocked by browser policy until user interaction
      });
    }

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioSource, autoPlay]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // Speed change
  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  // Canvas visualizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 48;
      const barWidth = width / numBars - 2;
      const centerY = height / 2;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 6;
        if (isPlaying) {
          // Animated wave simulation
          const wave1 = Math.sin(phase + i * 0.28) * 0.5 + 0.5;
          const wave2 = Math.cos(phase * 1.5 + i * 0.15) * 0.5 + 0.5;
          const amp = (wave1 * 0.6 + wave2 * 0.4);
          barHeight = 6 + amp * (height * 0.75);
        } else {
          // Static soft wave when paused
          const amp = Math.sin(i * 0.2) * 0.3 + 0.4;
          barHeight = 4 + amp * 12;
        }

        const x = i * (barWidth + 2);
        const y = centerY - barHeight / 2;

        // Gradient color
        const progress = i / numBars;
        const currentProgress = duration > 0 ? currentTime / duration : 0;
        const isPast = progress <= currentProgress;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isPast) {
          grad.addColorStop(0, '#38bdf8'); // sky-400
          grad.addColorStop(1, '#6366f1'); // indigo-500
        } else {
          grad.addColorStop(0, '#334155'); // slate-700
          grad.addColorStop(1, '#1e293b'); // slate-800
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.08 * playbackRate;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration, playbackRate]);

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Format bytes
  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  // Download Trigger
  const handleDownload = (format: 'mp3' | 'wav') => {
    let isMp3 = format === 'mp3';
    let base64Data = isMp3 ? speech.mp3Base64 : speech.wavBase64;
    let mime = isMp3 ? 'audio/mp3' : 'audio/wav';
    let ext = isMp3 ? 'mp3' : 'wav';

    // If MP3 requested but only WAV is available, fallback to WAV gracefully
    if (isMp3 && !base64Data && speech.wavBase64) {
      base64Data = speech.wavBase64;
      mime = 'audio/wav';
      ext = 'wav';
    }

    if (!base64Data) {
      alert('ទិន្នន័យសំឡេងមិនទាន់រួចរាល់');
      return;
    }

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime });
    const url = URL.createObjectURL(blob);

    const safeName = sanitizeFileName(customFileName.trim()) || getDefaultFileName(speech);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(format);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleDownloadSrt = () => {
    if (!speech.text) return;
    const safeName = sanitizeFileName(customFileName.trim()) || getDefaultFileName(speech);
    const actualDuration = duration > 0 ? duration : speech.durationSeconds || 5;
    downloadSrtFile({
      text: speech.text,
      durationSeconds: actualDuration,
      fileName: safeName,
      cues: speech.subtitleCues,
    });
    setDownloadSuccess('srt');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleDownloadWord = async () => {
    if (!speech.text) return;
    const safeName = sanitizeFileName(customFileName.trim()) || getDefaultFileName(speech);
    const styleLabel = STYLES.find((s) => s.id === speech.style)?.labelKh || speech.style;
    try {
      await downloadWordFile({
        text: speech.text,
        fileName: safeName,
        title: safeName.replace(/_/g, ' '),
        voice: speech.voice,
        styleLabel,
        durationSeconds: Math.round((duration || speech.durationSeconds || 0) * 10) / 10,
        isDialogue: speech.isDialogue,
      });
      setDownloadSuccess('docx');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to export Word document:', err);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-300">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <audio ref={audioRef} />

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">
                {speech.isDialogue ? `កិច្ចសន្ទនា (${speech.voice})` : `សំឡេង: ${speech.voice}`}
              </span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                speech.gender === 'female'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
              }`}>
                {speech.isDialogue ? 'សន្ទនា' : speech.gender === 'female' ? 'សំឡេងស្រី' : 'សំឡេងប្រុស'}
              </span>
              {speech.language && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                  {speech.language === 'en' ? '🇺🇸 English' : speech.language === 'km' ? '🇰🇭 ខ្មែរ' : '🌐 ខ្មែរ+EN'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              រចនាប័ទ្ម: {STYLES.find((s) => s.id === speech.style)?.labelKh || speech.style} • រយៈពេល: {formatTime(duration)}
            </p>
          </div>
        </div>

        {/* Speed presets */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          {[0.8, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => handleSpeedChange(rate)}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                playbackRate === rate
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Visualizer */}
      <div className="w-full bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 mb-3 shadow-inner">
        <canvas
          ref={canvasRef}
          width={520}
          height={64}
          className="w-full h-16 block rounded cursor-pointer"
          onClick={togglePlay}
          title="ចុចដើម្បីចាក់ ឬផ្អាក"
        />
      </div>

      {/* Timeline Scrubber */}
      <div className="space-y-1 mb-4">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/70">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all transform active:scale-95 shadow-lg ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
            title={isPlaying ? 'ផ្អាក (Space)' : 'ចាក់ (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Replay */}
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
              }
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            title="ចាក់ឡើងវិញពីដើម"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Loop */}
          <button
            onClick={toggleLoop}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-xs font-semibold ${
              isLooping
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={isLooping ? 'បិទការចាក់សារឡើងវិញ' : 'បើកការចាក់សារឡើងវិញ'}
          >
            សារ
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Dedicated Download & Rename Section */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-slate-300 font-medium flex items-center gap-1.5">
            <FileAudio className="w-4 h-4 text-amber-400" />
            <span>កែឈ្មោះឯកសារទាញយក (Edit File Name)៖</span>
          </label>
          <button
            type="button"
            onClick={() => setCustomFileName(getDefaultFileName(speech))}
            className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            title="ត្រឡប់ទៅឈ្មោះលំនាំដើម"
          >
            <RotateCcw className="w-3 h-3" />
            <span>ឈ្មោះដើម</span>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* File Name Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Edit3 className="w-3.5 h-3.5 text-amber-400/80" />
            </div>
            <input
              type="text"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              placeholder="វាយឈ្មោះឯកសារនៅទីនេះ (ឧ. រឿងព្រេង_ភាគ១)..."
              className="w-full pl-9 pr-36 py-2.5 bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-amber-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-sans"
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700">
                .mp3 / .wav / .srt / .docx
              </span>
            </div>
          </div>

          {/* Download Buttons: MP3, WAV, SRT, Word */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            {/* MP3 Download Button */}
            <button
              type="button"
              onClick={() => handleDownload('mp3')}
              className="group relative flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-md shadow-emerald-900/30 transition-all transform active:scale-95"
              title={`ទាញយកជា ${(sanitizeFileName(customFileName) || 'audio') + '.mp3'}`}
            >
              {downloadSuccess === 'mp3' ? (
                <Check className="w-4 h-4 text-emerald-200" />
              ) : (
                <Download className="w-4 h-4 text-emerald-200 group-hover:translate-y-0.5 transition-transform" />
              )}
              <div className="text-left leading-tight">
                <div className="font-bold flex items-center gap-1">
                  <span>ទាញ MP3</span>
                  <span className="text-[9px] px-1 bg-black/25 rounded">192k</span>
                </div>
                <div className="text-[9px] text-emerald-100/80 font-normal">
                  {speech.mp3Size ? formatSize(speech.mp3Size) : 'ស្រាល & ច្បាស់'}
                </div>
              </div>
            </button>

            {/* WAV Download Button */}
            <button
              type="button"
              onClick={() => handleDownload('wav')}
              className="group relative flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs shadow-md shadow-amber-900/30 transition-all transform active:scale-95"
              title={`ទាញយកជា ${(sanitizeFileName(customFileName) || 'audio') + '.wav'}`}
            >
              {downloadSuccess === 'wav' ? (
                <Check className="w-4 h-4 text-amber-200" />
              ) : (
                <Download className="w-4 h-4 text-amber-200 group-hover:translate-y-0.5 transition-transform" />
              )}
              <div className="text-left leading-tight">
                <div className="font-bold flex items-center gap-1">
                  <span>ទាញ WAV</span>
                  <span className="text-[9px] px-1 bg-black/25 rounded">24kHz</span>
                </div>
                <div className="text-[9px] text-amber-100/80 font-normal">
                  {speech.wavSize ? formatSize(speech.wavSize) : 'Studio HD'}
                </div>
              </div>
            </button>

            {/* SRT Subtitle Download Button */}
            <button
              type="button"
              onClick={handleDownloadSrt}
              className="group relative flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-medium text-xs shadow-md shadow-cyan-900/30 transition-all transform active:scale-95"
              title={`ទាញយកអក្សររត់ ${(sanitizeFileName(customFileName) || 'subtitle') + '.srt'}`}
            >
              {downloadSuccess === 'srt' ? (
                <Check className="w-4 h-4 text-cyan-200" />
              ) : (
                <Captions className="w-4 h-4 text-cyan-200 group-hover:translate-y-0.5 transition-transform" />
              )}
              <div className="text-left leading-tight">
                <div className="font-bold flex items-center gap-1">
                  <span>ទាញ SRT</span>
                  <span className="text-[9px] px-1 bg-black/25 rounded">Sub</span>
                </div>
                <div className="text-[9px] text-cyan-100/80 font-normal">
                  អក្សររត់វីដេអូ
                </div>
              </div>
            </button>

            {/* Word (.docx) Download Button */}
            <button
              type="button"
              onClick={handleDownloadWord}
              className="group relative flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-indigo-900/30 transition-all transform active:scale-95"
              title={`ទាញយកឯកសារ Word ${(sanitizeFileName(customFileName) || 'document') + '.docx'}`}
            >
              {downloadSuccess === 'docx' ? (
                <Check className="w-4 h-4 text-indigo-200" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-200 group-hover:translate-y-0.5 transition-transform" />
              )}
              <div className="text-left leading-tight">
                <div className="font-bold flex items-center gap-1">
                  <span>ទាញ Word</span>
                  <span className="text-[9px] px-1 bg-black/25 rounded">.docx</span>
                </div>
                <div className="text-[9px] text-indigo-100/80 font-normal">
                  ឯកសារអត្ថបទ
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
