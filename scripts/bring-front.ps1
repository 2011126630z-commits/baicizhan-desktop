param([Parameter(Mandatory=$true)][int]$Hwnd)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FgLogin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
}
"@
$h = [IntPtr]$Hwnd
[FgLogin]::ShowWindow($h, 9) | Out-Null
[FgLogin]::BringWindowToTop($h) | Out-Null
[FgLogin]::SetWindowPos($h, [IntPtr]::new(-1), 0, 0, 0, 0, 0x0003) | Out-Null
[FgLogin]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 600
[FgLogin]::SetWindowPos($h, [IntPtr]::new(-2), 0, 0, 0, 0, 0x0003) | Out-Null
Write-Output "FRONT_OK"
