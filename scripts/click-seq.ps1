param(
  [Parameter(Mandatory=$true)][string]$Clicks,   # "x1,y1;x2,y2;..."
  [string]$Keys = "",
  [string]$OutPath = ""
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinClk2 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
"@
$p = Get-Process baicizhan-desktop -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "NO_PROC"; exit 1 }
$h = $p.MainWindowHandle

# 激活主窗口（不再发送任何前置按键，避免触发应用快捷键）
[WinClk2]::ShowWindow($h, 3) | Out-Null
[WinClk2]::SetForegroundWindow($h) | Out-Null
[WinClk2]::SetWindowPos($h, [IntPtr]::new(-1), 0, 0, 0, 0, 0x0003) | Out-Null  # TOPMOST + NOSIZE
Start-Sleep -Milliseconds 900

foreach ($pair in $Clicks.Split(";")) {
  $xy = $pair.Split(",")
  [WinClk2]::SetCursorPos([int]$xy[0], [int]$xy[1]) | Out-Null
  Start-Sleep -Milliseconds 200
  [WinClk2]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero)
  [WinClk2]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 800
}
if ($Keys -ne "") {
  # 键盘输入需要真正的焦点：用 AppActivate 按 PID 激活（比 SetForegroundWindow 更可靠）
  $wshell = New-Object -ComObject WScript.Shell
  $null = $wshell.AppActivate([int]$p.Id)
  Start-Sleep -Milliseconds 600
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  Start-Sleep -Milliseconds 500
}
if ($OutPath -ne "") {
  Start-Sleep -Milliseconds 400
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $g.Dispose(); $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
# 取消置顶，避免影响后续（保持最大化）
[WinClk2]::SetWindowPos($h, [IntPtr]::new(-2), 0, 0, 0, 0, 0x0003) | Out-Null
Write-Output "DONE"
