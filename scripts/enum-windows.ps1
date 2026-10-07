param([int]$TargetPid = 0)
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WinEnum {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextW(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern int GetClassNameW(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static List<string> List(uint want) {
    var outList = new List<string>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == want) {
        var t = new StringBuilder(256); GetWindowTextW(h, t, 256);
        var c = new StringBuilder(256); GetClassNameW(h, c, 256);
        RECT r; GetWindowRect(h, out r);
        outList.Add(string.Format("hwnd={0} visible={1} class={2} title='{3}' rect={4}x{5}",
          h, IsWindowVisible(h), c, t, r.R - r.L, r.B - r.T));
      }
      return true;
    }, IntPtr.Zero);
    return outList;
  }
}
"@
$proc = if ($TargetPid -gt 0) { Get-Process -Id $TargetPid -ErrorAction SilentlyContinue } else { Get-Process baicizhan-desktop -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $proc) { Write-Output "NO_PROC"; exit 0 }
[WinEnum]::List([uint32]$proc.Id) | ForEach-Object { Write-Output $_ }
