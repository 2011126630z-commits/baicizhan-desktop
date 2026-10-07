param(
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [string]$Keys = "",
  [string]$OutPath = ""
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Drive {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  public const uint LEFTDOWN = 0x02; public const uint LEFTUP = 0x04;
}
"@
$p = Get-Process | Where-Object { $_.Name -like "*baicizhan*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "NO_WINDOW"; exit 1 }
[Win32Drive]::ShowWindow($p.MainWindowHandle, 3) | Out-Null
[Win32Drive]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 700
if ($X -ge 0 -and $Y -ge 0) {
  [Win32Drive]::SetCursorPos($X, $Y) | Out-Null
  Start-Sleep -Milliseconds 200
  [Win32Drive]::mouse_event([Win32Drive]::LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
  [Win32Drive]::mouse_event([Win32Drive]::LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
}
if ($Keys -ne "") {
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  Start-Sleep -Milliseconds 400
}
if ($OutPath -ne "") {
  Start-Sleep -Milliseconds 400
  Add-Type -AssemblyName System.Drawing
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $g.Dispose()
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Write-Output "DONE"
