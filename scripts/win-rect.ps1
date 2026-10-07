param()
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinRectQ {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$p = Get-Process baicizhan-desktop -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "NO_PROC"; exit 0 }
$r = New-Object WinRectQ+RECT
[WinRectQ]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
$zoomed = [WinRectQ]::IsZoomed($p.MainWindowHandle)
Write-Output ("Rect: L={0} T={1} W={2} H={3} Zoomed={4}" -f $r.L, $r.T, ($r.R - $r.L), ($r.B - $r.T), $zoomed)
