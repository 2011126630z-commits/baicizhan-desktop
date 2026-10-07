param([string]$OutPath = "D:\Baicizhan-PC\scripts\appicon.png")

Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$g.Clear([System.Drawing.Color]::Transparent)

$radius = 230
$rect = New-Object System.Drawing.Rectangle(20, 20, ($size - 40), ($size - 40))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $radius * 2
$path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
$path.AddArc(($rect.Right - $d), $rect.Y, $d, $d, 270, 90)
$path.AddArc(($rect.Right - $d), ($rect.Bottom - $d), $d, $d, 0, 90)
$path.AddArc($rect.X, ($rect.Bottom - $d), $d, $d, 90, 90)
$path.CloseFigure()

$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 12, 166, 120), [System.Drawing.Color]::FromArgb(255, 7, 133, 96), 90)
$g.FillPath($brush, $path)

# center char U+767E
$bai = [string][char]0x767E
$font = New-Object System.Drawing.Font("Microsoft YaHei", 430, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$textBrush = [System.Drawing.Brushes]::White
$g.DrawString($bai, $font, $textBrush, (New-Object System.Drawing.RectangleF(0, -20, $size, $size)), $fmt)

$g.Dispose()
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output ("ICON_SAVED: " + $OutPath)
