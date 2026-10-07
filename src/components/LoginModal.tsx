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
    <Modal open={open} title="官方登录流程" onClose={onClose} width={500}>
      <ol style={{ fontSize: 13.5, color: "var(--text-2)", paddingLeft: 20, lineHeight: 2 }}>
        <li>已为你打开百词斩官方登录页（www.baicizhan.com/login）</li>
        <li>请在官方页面中完成登录（邮箱/密码，或第三方登录，均由官方处理）</li>
        <li>登录成功后，回到这里点击「我已完成登录」</li>
      </ol>
      <div
        style={{
          fontSize: 12,
          color: "var(--warn)",
          background: "rgba(232, 89, 12, 0.08)",
          borderRadius: 8,
          padding: "8px 12px",
          margin: "10px 0",
          lineHeight: 1.8,
        }}
      >
        实测（2026-10-08）：官方「微信登录」当前返回 <strong>redirect_uri 参数错误</strong>
        （标准浏览器访问官方页面同样出现，属官方 OAuth 配置问题）；
        <strong>建议优先使用「邮箱 + 密码」登录</strong>（服务端实测可用）。
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 16px", lineHeight: 1.7 }}>
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
