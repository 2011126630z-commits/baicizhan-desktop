param([string]$Out1 = "D:\Baicizhan-PC\logs\rect-restore.png", [string]$Out2 = "D:\Baicizhan-PC\logs\rect-max.png")
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinRectExp {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$p = Get-Process baicizhan-desktop -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "NO_PROC"; exit 0 }
$h = $p.MainWindowHandle

function Shot($path) {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $g.Dispose(); $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

[WinRectExp]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
[WinRectExp]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 1200
$r = New-Object WinRectExp+RECT
[WinRectExp]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("RESTORE rect: {0}x{1}" -f ($r.R - $r.L), ($r.B - $r.T))
Shot $Out1

[WinRectExp]::ShowWindow($h, 3) | Out-Null   # SW_MAXIMIZE
Start-Sleep -Milliseconds 1500
[WinRectExp]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("MAX rect: {0}x{1}" -f ($r.R - $r.L), ($r.B - $r.T))
Shot $Out2
Write-Output "DONE"
