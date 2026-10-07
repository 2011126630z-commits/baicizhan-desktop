import type { ReactNode } from "react";
import { useToast } from "../stores/toast";

export function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  width,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={width ? { width } : undefined}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export function KeyCap({ label }: { label: string }) {
  return <span className="kbd">{label}</span>;
}

export function EmptyState({ icon = "📭", text, children }: { icon?: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <div>{text}</div>
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 120,
  stroke = 10,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, percent));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg className="ring" width={size} height={size}>
        <circle className="bg" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
