# 百词斩桌面版（非官方）

> **非百词斩官方 Windows 客户端**，本项目仅作为个人桌面学习工具。与百词斩官方无任何关联。

一个为 Windows 桌面重新设计的背单词客户端：Tauri 2 + React + TypeScript + Rust + SQLite，
安装后体积小（不打包 Chromium），支持键盘背词、本地缓存、官方网页登录、运行时同步能力检测。

## 功能

- **官方登录**：通过 WebView2 打开百词斩官方网页，在官方页面完成登录（账号/扫码/短信均由官方处理）。
  桌面端不读取、不记录、不上传密码；登录会话保存在 **Windows 凭据管理器**。
- **本地学习内核**：词书、学习计划、SRS 复习、收藏、统计全部保存在本地 SQLite；
  所有学习操作先写入操作队列（含 operationId 幂等），UI 立即响应。
- **同步能力检测**：启动后 CapabilityDetector 通过官方正常渠道探测当前会话可用的数据能力，
  结果在「设置 → 同步」展示，并导出 `docs/capabilities.md`。
  **官方渠道暂不支持的功能一律如实标注，绝不伪造“同步成功”。**
- **键盘背词**：Space 发音 / 1 认识 / 2 模糊 / 3 不认识 / Enter 下一步 / ↑↓ 切换 / Ctrl+D 收藏 / Esc 暂停，快捷键可在设置中修改（含冲突检测）。
- **沉浸模式**：F11 或 Ctrl+Shift+F 隐藏侧栏与状态栏，专注学习。
- **小窗背词**：400×280 独立小窗，可置顶、可拖动，一边做别的事一边复习。
- **系统托盘**：打开主窗口 / 开始今日学习 / 小窗背词 / 退出；关闭窗口可选「最小化到托盘」并记住选择。
- **离线可用**：断网时显示本地缓存并提示「当前离线 · 显示上次同步内容」，网络恢复后自动同步。
- **发音**：官方音频地址（如有）优先，其次 Windows 系统语音合成（完全本地，离线可用）。
- **主题**：浅色 / 深色 / 跟随系统；三档字体大小。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Tauri 2（WebView2，非 Electron） |
| 前端 | React 18 + TypeScript + Vite |
| 状态 | Zustand |
| 后端 | Rust（rusqlite、reqwest、keyring、tts） |
| 存储 | SQLite（本地数据）+ Windows 凭据管理器（会话） |
| 图标 | Lucide Icons；图表为内置轻量 SVG 组件 |

## 同步与安全（v0.2.0）

- **登录真实性**：捕获会话 ≠ 已登录。程序会携带会话访问官方页面执行 SessionProbe 验证；
  官方页面无法提供身份证据时如实显示「会话待验证」，绝不显示为已登录。
- **状态三行分离**：本地数据（已保存）/ 百词斩账号（登录状态）/ 官方学习同步（暂不可用或已同步），
  三者严格区分，没有官方同步时不会出现「同步完成」。
- **Cookie 安全**：认证请求仅允许 `baicizhan.com` 及其子域（单元测试覆盖 evilbaicizhan.com
  等边界）；Cookie 按域名/路径匹配发送；跨域重定向立即停止；会话仅存 Windows 凭据管理器，
  不落日志、不进报告。
- **出站请求**：仅 https 官方域名；IP、localhost、私网一律拒绝。

## 数据与隐私

- **密码**：全程不经过本程序。登录在 WebView2 中的官方网页内完成。
- **会话**：仅保存在 Windows 凭据管理器（keyring / WinCredential）。
- **学习数据**：SQLite，位于 `%APPDATA%\com.baicizhandesktop.app\data.sqlite3`。
- **日志**：`%LOCALAPPDATA%\com.baicizhandesktop.app\logs\app.log`（滚动，不含 Cookie/Token/密码）。
- 不上传任何数据到第三方；应用没有自己的服务端；无遥测、无统计 SDK、无广告。

## 常见问题

**快捷键没反应？**
部分输入法（如搜狗）会全局占用 `Ctrl+,` 等组合。可在「设置 → 快捷键」里改成别的组合（如 `Ctrl+Alt+S`），或先在输入法设置中释放该快捷键。

**小窗在哪里？**
首页「小窗背词」按钮，或右键系统托盘图标 →「小窗背词」。小窗默认可置顶，也支持拖动、收起和返回主窗口。

**数据会同步到手机吗？**
登录后应用会尝试通过官方网页渠道同步；当前官方渠道未开放学习数据读写，界面中会如实显示「本地记录，暂未同步至百词斩」，不会伪造同步结果。

## 开发

```bash
npm install
npm run tauri dev     # 开发运行（自动打开桌面窗口）
```

依赖：Node.js ≥ 20、Rust (MSVC)、Visual Studio Build Tools (C++)、WebView2 Runtime（Win10/11 一般自带）。

## 构建安装包

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`：
- `nsis/BaicizhanDesktop_0.1.0_x64-setup.exe`（NSIS 安装包，拷贝到 `releases/BaicizhanDesktop_Setup_x64.exe`）
- `msi/BaicizhanDesktop_0.1.0_x64_zh-CN.msi`（需要 WiX 工具链，联网自动下载）

安装后：开始菜单与桌面创建「BaicizhanDesktop」快捷方式，按用户级安装（无需管理员）。

> 网络访问 GitHub 受限时，NSIS 打包工具可能下载超时：
> 先运行 `powershell -ExecutionPolicy Bypass -File scripts\fix-nsis-cache.ps1` 恢复工具缓存再打包。

## 发布到 GitHub

见 [docs/RELEASE-GUIDE.md](docs/RELEASE-GUIDE.md)（需要你本人完成一次 GitHub 设备授权，其余自动完成）。

## 目录结构

```
D:\Baicizhan-PC
├─ src/                 # React 前端
│  ├─ pages/            # Home / Study / Review / WordBook / Search / Statistics / Settings / Mini
│  ├─ components/       # Sidebar、StatusBar、WordCard、图表、通用 UI
│  ├─ services/         # auth / sync / study / audio / storage
│  ├─ adapters/         # OfficialWebAdapter / LocalAdapter / 统一接口（可替换数据源）
│  ├─ stores/           # Zustand：settings / auth / sync / study / toast
│  ├─ hooks/ utils/ types/ data/
├─ src-tauri/           # Rust 后端（命令、SQLite、托盘、TTS、HTTP+SSRF 防护、凭据管理）
├─ docs/                # capabilities.md（运行时能力报告）
├─ scripts/             # 图标生成等
├─ releases/            # 安装包
└─ logs/                # 开发日志
```

## 同步能力（摘要）

| 数据 | 状态 |
| --- | --- |
| 登录（官方网页） | ✅ 可用 |
| 学习记录（本地） | ✅ 本地完整 |
| 词书/复习/统计（本地） | ✅ 本地完整 |
| 账号信息/当前词书/学习计划/复习列表（官方读取） | ⏳ 待官方渠道开放 |
| 学习结果回写 / 收藏回写（官方写入） | ❌ 当前官方渠道暂不支持 |

详见 [docs/capabilities.md](docs/capabilities.md)（应用运行时会自动更新）。

## 已知限制

- 官方渠道当前没有公开的桌面端数据接口，因此**学习进度暂不能写回手机百词斩**；
  界面中所有未同步的数据都会明确标注「本地记录，暂未同步至百词斩」。
- 词书数据默认内置一份自制的示例词表（核心词汇），支持 CSV 导入扩展
  （格式：`word,phonetic,pos,释义1;释义2,例句,例句翻译`）。
- 本项目不修改百词斩官方程序，不破解签名/风控，不批量下载受版权保护的音频图片资源。

## 隐私

- 不上传任何学习数据、搜索记录到任何第三方服务器；本项目没有自己的账号系统。
- 会话信息仅保存在本机 Windows 凭据管理器；日志不含 Cookie/Token。
