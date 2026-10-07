import { useState } from "react";
import { Modal, Spinner } from "./ui";
import { AuthService } from "../services/auth/AuthService";

/**
 * 官方登录确认流程（账户页与同步页共用）。
 * 提示用户在官方页面完成登录后回到这里确认；捕获会话后仍需通过 SessionProbe
 * 验证身份，验证不过不会显示“已登录”。
 */
export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Modal open={open} title="官方登录流程" onClose={onClose} width={490}>
      <ol style={{ fontSize: 13.5, color: "var(--text-2)", paddingLeft: 20, lineHeight: 2 }}>
        <li>已为你打开百词斩官方网页登录窗口</li>
        <li>请在官方页面中完成登录（账号密码 / 扫码 / 短信，均由官方处理）</li>
        <li>登录成功后，回到这里点击「我已完成登录」</li>
      </ol>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "10px 0 16px", lineHeight: 1.7 }}>
        桌面版不读取、不记录、不上传你的密码；只保存登录后的会话（Windows 凭据管理器加密存储）。
        捕获会话后程序会携带会话访问官方页面<strong>验证账号身份</strong>——
        若无法验证，将如实显示「会话待验证」，不会显示为已登录。
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          className="btn"
          onClick={async () => {
            onClose();
            await AuthService.cancelLogin();
          }}
        >
          取消
        </button>
        <button
          className="btn btn-primary"
          autoFocus
          disabled={confirming}
          onClick={async () => {
            setConfirming(true);
            await AuthService.confirmLogin();
            setConfirming(false);
            onClose();
          }}
        >
          {confirming ? <Spinner /> : null}
          我已完成登录
        </button>
      </div>
    </Modal>
  );
}
