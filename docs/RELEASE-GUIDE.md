# GitHub 发布指南

安装包已经生成在 `releases\BaicizhanDesktop_Setup_x64.exe`（3.6 MB）。
发布到 GitHub 只差一步：**用你的 GitHub 账号完成一次授权**（账号安全要求，必须本人操作）。

## 第一步：登录 GitHub（只需一次）

双击运行（或在命令行执行）：

```
scripts\gh-login.bat
```

- 终端会显示一次性代码（形如 `XXXX-XXXX` 并已复制到剪贴板）
- 浏览器打开 https://github.com/login/device （若未自动打开请手动访问）
- 粘贴代码 → 点击 **Authorize github**

> 如果你的网络访问 GitHub 不稳定：
> 1. 先打开你的代理软件（本机检测到系统代理 `127.0.0.1:10090`）
> 2. `gh-login.bat` 已内置该代理设置，直接运行即可

## 第二步：一键发布

登录成功后，双击运行（或在命令行执行）：

```
powershell -ExecutionPolicy Bypass -File scripts\publish-github.ps1
```

脚本会自动完成：

1. 创建公开仓库 `baicizhan-desktop` 并推送全部代码
2. 创建 Release `v0.1.0`（含功能说明和已知限制）
3. 上传 `releases\BaicizhanDesktop_Setup_x64.exe` 到 Release

完成后会打印仓库与 Release 链接。

## 常见问题

**Q: 提示 `gh` 不是内部命令？**
脚本使用完整路径 `C:\Program Files\GitHub CLI\gh.exe`，无需配置 PATH。

**Q: 想改仓库名或版本号？**
```
powershell -ExecutionPolicy Bypass -File scripts\publish-github.ps1 -RepoName 你的名字 -Version 0.1.0
```

**Q: 稍后想发新版本？**
1. 更新 `package.json` 与 `src-tauri/tauri.conf.json` 里的 `version`
2. 重新打包：`npm run tauri build -- --bundles nsis`
   （若报 NSIS 下载超时，先运行 `powershell -ExecutionPolicy Bypass -File scripts\fix-nsis-cache.ps1`）
3. 复制新安装包到 `releases\BaicizhanDesktop_Setup_x64.exe`
4. 再次运行 `publish-github.ps1`（会创建新 tag）

**Q: 需要 MSI 安装包？**
本项目默认同时配置了 `nsis` 和 `msi` 两种目标。MSI 需要下载 WiX 工具链
（`npm run tauri build -- --bundles msi`），网络通畅时会自动下载；
当前网络环境下网络波动会导致超时，可稍后重试。
NSIS 安装包（Setup.exe）功能完全一致，并且支持桌面/开始菜单快捷方式。
