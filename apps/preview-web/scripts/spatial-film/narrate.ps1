param(
    [Parameter(Mandatory = $true)][string]$Manifest,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$configuration = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voice = $speech.GetInstalledVoices() | Where-Object {
        $_.Enabled -and $_.VoiceInfo.Name -eq $configuration.voice -and $_.VoiceInfo.Gender -eq "Male"
    } | Select-Object -First 1
    if (-not $voice) {
        throw "The requested local male voice is unavailable: $($configuration.voice)"
    }
    $speech.SelectVoice($voice.VoiceInfo.Name)
    $speech.Rate = -1
    $speech.Volume = 100
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
        24000,
        [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
        [System.Speech.AudioFormat.AudioChannel]::Mono
    )
    $cueIndex = 0
    foreach ($cue in $configuration.cues) {
        $outputPath = Join-Path $OutputDirectory ("cue-{0:D2}.wav" -f $cueIndex)
        if (Test-Path -LiteralPath $outputPath) { throw "Refusing to overwrite $outputPath" }
        $speech.SetOutputToWaveFile($outputPath, $format)
        $spokenText = if ($cue.spoken) { $cue.spoken } else { $cue.text }
        $speech.Speak([string]$spokenText)
        $speech.SetOutputToNull()
        Write-Output ("Narrated cue {0}: {1}" -f ($cueIndex + 1), $cue.text)
        $cueIndex += 1
    }
} finally {
    $speech.Dispose()
}
