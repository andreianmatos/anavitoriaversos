$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcDir = Join-Path $root "imagens"
$thumbDir = Join-Path $srcDir "thumbs"
$maxWidth = 560
$jpegQuality = 82L

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" }

$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
  [System.Drawing.Imaging.Encoder]::Quality,
  $jpegQuality
)

New-Item -ItemType Directory -Force -Path $thumbDir | Out-Null

Get-ChildItem -Path $srcDir -File | ForEach-Object {
  $file = $_.Name
  $ext = $_.Extension.ToLower()
  $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
  $outName = if ($ext -eq ".gif") { "$base.gif" } else { "$base.jpg" }
  $outPath = Join-Path $thumbDir $outName

  if ($ext -eq ".gif") {
    Copy-Item -Path $_.FullName -Destination $outPath -Force
    Write-Host "copied gif: $outName"
    return
  }

  $image = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $ratio = $maxWidth / $image.Width
    $newWidth = [Math]::Min($maxWidth, $image.Width)
    $newHeight = [int]($image.Height * ($newWidth / $image.Width))

    $bitmap = New-Object System.Drawing.Bitmap $newWidth, $newHeight
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)
      $bitmap.Save($outPath, $encoder, $encoderParams)
      Write-Host "thumb: $outName"
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
  finally {
    $image.Dispose()
  }
}

Write-Host "done"
