import type { SessionState } from "../types/models";

/**
 * 统一 Provider 接口：官方渠道变化时只替换实现，不需要改 UI。
 * - AuthProvider：登录/会话生命周期
 * - SyncProvider：同步调度（见 SyncManager）
 * - AudioProvider：发音播放（见 AudioService）
 * - StudyDataProvider：学习数据读写（见 adapters/types.ts）
 */

export interface AuthProvider {
  readonly name: string;
  /** 启动时恢复会话状态（本地保存的会话是否存在） */
  init(): Promise<void>;
  /** 打开官方登录页面（由官方页面处理账号密码/扫码等） */
  openLogin(): Promise<void>;
  /** 用户在官方页面完成登录后，采集会话（绝不接触密码） */
  confirmLogin(): Promise<{ ok: boolean; message: string }>;
  logout(): Promise<void>;
  getState(): SessionState;
}

export interface SyncProvider {
  readonly name: string;
  /** 启动后台同步循环（首屏不阻塞） */
  start(): void;
  stop(): void;
  /** 触发一次完整同步（attempt=manual 时给出用户可见反馈） */
  syncAll(trigger: "auto" | "manual"): Promise<void>;
  /** 重试失败/不支持的操作队列 */
  retryQueue(): Promise<void>;
}

export interface AudioProvider {
  readonly name: string;
  /** 播放单词发音：官方音频（如有）优先，本地 TTS 兜底 */
  play(word: { word: string; audioUrl?: string | null }): Promise<void>;
}
