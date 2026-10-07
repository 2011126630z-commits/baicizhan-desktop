import { create } from "zustand";

export interface ToastItem {
  id: number;
  text: string;
  type: "info" | "success" | "warn" | "error";
}

interface ToastState {
  toasts: ToastItem[];
  push: (text: string, type?: ToastItem["type"]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, type = "info") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (t: string) => useToast.getState().push(t, "info"),
  success: (t: string) => useToast.getState().push(t, "success"),
  warn: (t: string) => useToast.getState().push(t, "warn"),
  error: (t: string) => useToast.getState().push(t, "error"),
};

// ---- 沉浸（专注）模式 ----
interface UiState {
  focusMode: boolean;
  toggleFocus: () => void;
  setFocus: (v: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  focusMode: false,
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode })),
  setFocus: (v) => set({ focusMode: v }),
}));

// ---- 关闭确认对话框 ----
interface CloseDialogState {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const useCloseDialog = create<CloseDialogState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));
