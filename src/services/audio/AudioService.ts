import { api } from "../storage/db";

let currentAudio: HTMLAudioElement | null = null;

/** 播放单词发音：官方音频地址（如有）优先，其次 Windows 系统语音合成（离线可用） */
export async function playWordAudio(word: { word: string; audioUrl?: string | null }): Promise<void> {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (word.audioUrl) {
    try {
      const a = new Audio(word.audioUrl);
      currentAudio = a;
      await a.play();
      return;
    } catch {
      /* 回退到 TTS */
    }
  }
  try {
    await api.speak(word.word);
  } catch {
    /* 无可用语音时静默失败，不打断学习流 */
  }
}
