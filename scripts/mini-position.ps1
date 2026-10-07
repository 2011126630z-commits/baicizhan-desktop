param(
  [Parameter(Mandatory=$true)][int]$Hwnd,
  [int]$X = 700,
  [int]$Y = 380,
  [string]$OutPath = "D:\Baicizhan-PC\logs\shot-mini5.png"
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MiniPos {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$h = [IntPtr]$Hwnd
$r = New-Object MiniPos+RECT
[MiniPos]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("before: L={0} T={1} W={2} H={3}" -f $r.L, $r.T, ($r.R - $r.L), ($r.B - $r.T))
# 移到 (X,Y)，尺寸不变，置顶
[MiniPos]::SetWindowPos($h, [IntPtr]::new(-1), $X, $Y, 0, 0, 0x0001 -bor 0x0002) | Out-Null  # NOSIZE|NOMOVE? -> use NOSIZE only
[MiniPos]::SetWindowPos($h, [IntPtr]::new(-1), $X, $Y, 0, 0, 0x0001) | Out-Null               # TOPMOST + NOSIZE
[MiniPos]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 900
[MiniPos]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("after: L={0} T={1} W={2} H={3}" -f $r.L, $r.T, ($r.R - $r.L), ($r.B - $r.T))

$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$g.Dispose()
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "DONE"
