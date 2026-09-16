param(
  [Parameter(Mandatory=$true)][string]$FfmpegDirectory,
  [string]$ReferenceDirectory = 'docs/reference/prototypes',
  [string]$OutputDirectory = 'docs/reference/frames'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
foreach ($name in @('cliente', 'repartidor', 'comercio')) {
  $source = Join-Path $ReferenceDirectory "$name.mp4"
  & (Join-Path $FfmpegDirectory 'ffprobe.exe') -v error -show_entries format=duration:stream=width,height -of json $source
  $width = if ($name -eq 'comercio') { 618 } else { 260 }
  $tile = if ($name -eq 'comercio') { '2x4' } else { '4x5' }
  & (Join-Path $FfmpegDirectory 'ffmpeg.exe') -hide_banner -loglevel error -i $source -vf "fps=1/3,scale=${width}:-1,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='%{pts\:hms}':fontsize=14:fontcolor=white:box=1:boxcolor=black@0.75:x=5:y=5,tile=${tile}:padding=4:margin=4:color=white" -fps_mode vfr (Join-Path $OutputDirectory "$name-%02d.jpg")
  if ($LASTEXITCODE -ne 0) { throw "No se pudo analizar $name" }
}
