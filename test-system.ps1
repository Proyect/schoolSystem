# Script de testing del sistema escolar
Write-Host "=== TESTING DEL SISTEMA ESCOLAR ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar servicios
Write-Host "1. Verificando servicios..." -ForegroundColor Yellow
try {
    $backend = Invoke-WebRequest -Uri "http://localhost:5051/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "   ✓ Backend respondiendo (puerto 5051)" -ForegroundColor Green
    Write-Host "   Respuesta: $($backend.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Backend NO responde" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:4001" -UseBasicParsing -TimeoutSec 3
    Write-Host "   ✓ Frontend respondiendo (puerto 4001)" -ForegroundColor Green
    Write-Host "   Status: $($frontend.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Frontend NO responde" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 2. Probar login
Write-Host "2. Probando login..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "admin@school.com"
        password = "password123"
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "http://localhost:5051/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -UseBasicParsing `
        -TimeoutSec 5

    $loginData = $loginResponse.Content | ConvertFrom-Json
    Write-Host "   ✓ Login exitoso" -ForegroundColor Green
    Write-Host "   Token recibido: $($loginData.token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "   Usuario: $($loginData.user.email) - Rol: $($loginData.user.role)" -ForegroundColor Gray
    
    $token = $loginData.token
} catch {
    Write-Host "   ✗ Login falló" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Respuesta: $responseBody" -ForegroundColor Red
    }
    $token = $null
}

Write-Host ""

# 3. Probar verificación de token
if ($token) {
    Write-Host "3. Probando verificación de token..." -ForegroundColor Yellow
    try {
        $verifyResponse = Invoke-WebRequest -Uri "http://localhost:5051/api/auth/verify" `
            -Method GET `
            -Headers @{Authorization = "Bearer $token"} `
            -UseBasicParsing `
            -TimeoutSec 5

        $verifyData = $verifyResponse.Content | ConvertFrom-Json
        Write-Host "   ✓ Verificación exitosa" -ForegroundColor Green
        Write-Host "   Usuario verificado: $($verifyData.user.email)" -ForegroundColor Gray
    } catch {
        Write-Host "   ✗ Verificación falló" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "3. Omitiendo verificación (no hay token)" -ForegroundColor Yellow
}

Write-Host ""

# 4. Verificar rutas del frontend
Write-Host "4. Verificando rutas del frontend..." -ForegroundColor Yellow
$routes = @("/", "/login", "/dashboard")
foreach ($route in $routes) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4001$route" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Write-Host "   ✓ $route - Status: $($response.StatusCode)" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 302 -or $_.Exception.Response.StatusCode -eq 307) {
            Write-Host "   → $route - Redirige (normal)" -ForegroundColor Cyan
        } else {
            Write-Host "   ✗ $route - Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""

# 5. Verificar procesos Node
Write-Host "5. Verificando procesos Node..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   ✓ Procesos Node encontrados: $($nodeProcesses.Count)" -ForegroundColor Green
    foreach ($proc in $nodeProcesses) {
        Write-Host "   - PID: $($proc.Id) - CPU: $([math]::Round($proc.CPU, 2))s" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ No se encontraron procesos Node" -ForegroundColor Red
}

Write-Host ""

# 6. Verificar puertos
Write-Host "6. Verificando puertos..." -ForegroundColor Yellow
$ports = @(5051, 4001)
foreach ($port in $ports) {
    $listening = netstat -ano | Select-String ":$port.*LISTENING"
    if ($listening) {
        Write-Host "   ✓ Puerto $port está en uso" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Puerto $port NO está en uso" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== FIN DEL TESTING ===" -ForegroundColor Cyan
