param(
  [Parameter(Mandatory=$true)][string]$MachineId,
  [Parameter(Mandatory=$true)][string]$Endpoint,
  [Parameter(Mandatory=$true)][string]$ApiKey,
  [switch]$NoSend
)

$ErrorActionPreference = 'Stop'

function Get-DriverInfo([string]$instanceId) {
  try {
    $props = Get-PnpDeviceProperty -InstanceId $instanceId -ErrorAction Stop
    $map = @{}
    foreach ($p in $props) { $map[$p.KeyName] = $p.Data }
    return [ordered]@{
      provider = [string]$map['DEVPKEY_Device_DriverProvider']
      version  = [string]$map['DEVPKEY_Device_DriverVersion']
      inf      = [string]$map['DEVPKEY_Device_DriverInfPath']
      service  = [string]$map['DEVPKEY_Device_Service']
    }
  } catch {
    return [ordered]@{ provider=$null; version=$null; inf=$null; service=$null }
  }
}

$devices = New-Object System.Collections.Generic.List[object]
$pnp = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue)

foreach ($d in $pnp | Where-Object { $_.Class -in @('Camera','Image') -or $_.FriendlyName -match '(?i)camera|webcam' }) {
  $drv = Get-DriverInfo $d.InstanceId
  $devices.Add([ordered]@{
    id = [string]$d.InstanceId
    type = 'CAMERA'
    name = [string]$d.FriendlyName
    vendor = $drv.provider
    model = [string]$d.FriendlyName
    driver = (@($drv.inf,$drv.version) | Where-Object {$_}) -join ' / '
    status = $(if ($d.Status -eq 'OK') {'ONLINE'} else {'DEGRADED'})
    capabilities = [ordered]@{ interface='PNP'; service=$drv.service; uvc=($drv.service -eq 'usbvideo') }
  })
}

foreach ($d in $pnp | Where-Object { $_.FriendlyName -match '(?i)qr|barcode|bar.?code|scanner' -and $_.FriendlyName -notmatch '(?i)fingerprint' }) {
  $drv = Get-DriverInfo $d.InstanceId
  $devices.Add([ordered]@{
    id = [string]$d.InstanceId
    type = 'QR_SCANNER'
    name = [string]$d.FriendlyName
    vendor = $drv.provider
    model = [string]$d.FriendlyName
    driver = (@($drv.inf,$drv.version) | Where-Object {$_}) -join ' / '
    status = $(if ($d.Status -eq 'OK') {'ONLINE'} else {'DEGRADED'})
    capabilities = [ordered]@{ interface='PNP' }
  })
}

foreach ($d in $pnp | Where-Object { $_.FriendlyName -match '(?i)verifone|ingenico|pax|pinpad|payment terminal|pos terminal|bank terminal' }) {
  $drv = Get-DriverInfo $d.InstanceId
  $devices.Add([ordered]@{
    id = [string]$d.InstanceId
    type = 'POS'
    name = [string]$d.FriendlyName
    vendor = $drv.provider
    model = [string]$d.FriendlyName
    driver = (@($drv.inf,$drv.version) | Where-Object {$_}) -join ' / '
    status = $(if ($d.Status -eq 'OK') {'ONLINE'} else {'DEGRADED'})
    capabilities = [ordered]@{ interface='PNP' }
  })
}

foreach ($d in $pnp | Where-Object { $_.Class -eq 'Ports' -or $_.FriendlyName -match '(?i)COM\d+' }) {
  $drv = Get-DriverInfo $d.InstanceId
  $isMdb = [bool]($d.FriendlyName -match '(?i)MDB')
  $devices.Add([ordered]@{
    id = [string]$d.InstanceId
    type = $(if ($isMdb) {'MDB'} else {'SERIAL'})
    name = [string]$d.FriendlyName
    vendor = $drv.provider
    model = [string]$d.FriendlyName
    driver = (@($drv.inf,$drv.version) | Where-Object {$_}) -join ' / '
    status = $(if ($d.Status -eq 'OK') {'ONLINE'} else {'DEGRADED'})
    capabilities = [ordered]@{ interface='SERIAL' }
  })
}

try {
  foreach ($n in Get-NetAdapter -ErrorAction Stop | Where-Object { $_.HardwareInterface -eq $true }) {
    $devices.Add([ordered]@{
      id = [string]$n.InterfaceGuid
      type = 'NETWORK'
      name = [string]$n.Name
      vendor = [string]$n.DriverProvider
      model = [string]$n.InterfaceDescription
      driver = [string]$n.DriverVersion
      status = $(if ($n.Status -eq 'Up') {'ONLINE'} elseif ($n.Status -eq 'Disabled') {'OFFLINE'} else {'DEGRADED'})
      capabilities = [ordered]@{ mediaType=[string]$n.MediaType; linkSpeed=[string]$n.LinkSpeed; macAddress=[string]$n.MacAddress }
    })
  }
} catch {}

$os = Get-CimInstance Win32_OperatingSystem
$webcamUser = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam' -ErrorAction SilentlyContinue
$webcamMachine = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam' -ErrorAction SilentlyContinue

$deviceArray = @($devices | ForEach-Object { $_ })

$snapshot = [ordered]@{
  scanId = [guid]::NewGuid().ToString()
  capturedAt = [DateTime]::UtcNow.ToString('o')
  agentVersion = 'softice-windows-hardware-scan/0.1.0'
  platform = ('Windows ' + $os.Version + ' ' + $env:PROCESSOR_ARCHITECTURE)
  devices = $deviceArray
  capabilities = [ordered]@{
    cameraPermissionUser = [string]$webcamUser.Value
    cameraPermissionMachine = [string]$webcamMachine.Value
    hostname = $env:COMPUTERNAME
    scanner = 'windows-pnp-v1'
  }
}

$json = $snapshot | ConvertTo-Json -Depth 8
if ($NoSend) {
  $json
  exit 0
}

$headers = @{ 'X-API-Key' = $ApiKey }
$response = Invoke-RestMethod -Method Post -Uri ($Endpoint.TrimEnd('/') + '/machines/' + [uri]::EscapeDataString($MachineId) + '/hardware-inventory') -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
$response | ConvertTo-Json -Depth 8
