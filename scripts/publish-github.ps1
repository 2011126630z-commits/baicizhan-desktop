# 一键发布到 GitHub（需先完成 gh auth login）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\publish-github.ps1
param(
  [string]$RepoName = "baicizhan-desktop",
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }

Write-Output "==> 检查 GitHub 登录状态"
& $gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Output "未登录。请先运行：gh auth login --hostname github.com --git-protocol https --web"
  exit 1
}

$user = (& $gh api user --jq .login).Trim()
Write-Output "已登录：$user"

Push-Location (Join-Path $PSScriptRoot "..")

Write-Output "==> 创建/获取仓库 $RepoName"
& $gh repo view "$user/$RepoName" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $RepoName --public --description "百词斩桌面版（非官方 Windows 客户端）· Tauri 2 + React + Rust" --source . --push
} else {
  git push -u origin main
}

Write-Output "==> 创建 Release v$Version 并上传安装包"
$tag = "v$Version"
$notes = @"
# 百词斩桌面版 v$Version（非官方）

Windows 桌面背单词客户端。**非百词斩官方客户端**，仅供个人学习使用。

## 安装
下载 `BaicizhanDesktop_Setup_x64.exe` 双击安装（用户级安装，无需管理员权限，自动创建桌面和开始菜单快捷方式）。

## 本版功能
- 官方网页登录（WebView2 内完成，密码不经过本程序；会话保存在 Windows 凭据管理器）
- 本地词书 + SQLite 学习记录（新学 / SRS 复习 / 收藏 / 统计）
- 键盘背词：空格发音、1 认识、2 模糊、3 不认识、回车继续、F11 沉浸模式，快捷键可自定义
- 小窗背词（可置顶）、系统托盘、离线可用、深浅主题
- 运行时数据能力检测：官方渠道暂不支持的能力会在界面中如实标注，不会伪造同步

## 已知限制
- 学习进度暂不能回写手机百词斩（官方网页未开放相应渠道，界面已明确标注）
- 词书默认内置一份自制核心词汇，可在「单词书」导入 CSV 扩展

详见 README 与 docs/capabilities.md。
"@

& $gh release view $tag 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Output "Release $tag 已存在，上传/覆盖安装包"
  & $gh release upload $tag --clobber "releases\BaicizhanDesktop_Setup_x64.exe"
} else {
  & $gh release create $tag --title "百词斩桌面版 v$Version" --notes $notes "releases\BaicizhanDesktop_Setup_x64.exe"
}
if ($LASTEXITCODE -ne 0) { throw "Release 上传失败" }

Write-Output "==> 完成：https://github.com/$user/$RepoName/releases/tag/$tag"
Pop-Location
