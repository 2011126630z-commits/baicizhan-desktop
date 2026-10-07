param(
  [Parameter(Mandatory=$true)][int]$Hwnd,
  [string]$OutPath = "D:\Baicizhan-PC\logs\shot-front.png"
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FrontW {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
[FrontW]::ShowWindow([IntPtr]$Hwnd, 5) | Out-Null
[FrontW]::BringWindowToTop([IntPtr]$Hwnd) | Out-Null
[FrontW]::SetForegroundWindow([IntPtr]$Hwnd) | Out-Null
Start-Sleep -Milliseconds 900
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$g.Dispose()
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "DONE"
