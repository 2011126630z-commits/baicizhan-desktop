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
- `msi/BaicizhanDesktop_0.1.0_x64_zh-CN.msi`

安装后：开始菜单与桌面创建「BaicizhanDesktop」快捷方式，按用户级安装（无需管理员）。

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
