# ========================================
# Setup Bolão Copa 2026
# Sem clone - apenas configuração local
# ========================================

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BOLÃO COPA DO MUNDO 2026 - SETUP      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js não encontrado" -ForegroundColor Red
    Write-Host "   Instale em: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Node.js encontrado" -ForegroundColor Green
Write-Host ""

# Pedir informações
Write-Host "📝 Suas credenciais Supabase" -ForegroundColor Yellow
Write-Host "   (encontre em: https://seu-projeto.supabase.co/settings/api)" -ForegroundColor DarkGray
Write-Host ""

$url = Read-Host "URL do Supabase"
if (-not $url) {
    Write-Host "❌ URL necessária" -ForegroundColor Red
    exit 1
}

$key = Read-Host "Anon Key"
if (-not $key) {
    Write-Host "❌ Anon Key necessária" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Instalando dependências..." -ForegroundColor Yellow
npm install 2>&1 | ForEach-Object {
    if ($_ -match "added|up to date|packages") {
        Write-Host "   $_" -ForegroundColor Green
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependências instaladas" -ForegroundColor Green
Write-Host ""

# Criar .env.local
Write-Host "🔐 Criando configuração..." -ForegroundColor Yellow
$env = @"
VITE_SUPABASE_URL=$url
VITE_SUPABASE_ANON_KEY=$key
"@

$env | Out-File -Encoding UTF8 ".env.local"
Write-Host "✅ Arquivo .env.local criado" -ForegroundColor Green

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ SETUP CONCLUÍDO!" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📌 PRÓXIMO PASSO:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣  Abrir Supabase:" -ForegroundColor White
Write-Host "   https://seu-projeto.supabase.co" -ForegroundColor DarkGray
Write-Host ""
Write-Host "2️⃣  Ir em: Database → SQL Editor" -ForegroundColor White
Write-Host ""
Write-Host "3️⃣  Copiar TODO o conteúdo de: schema-clean.sql" -ForegroundColor White
Write-Host ""
Write-Host "4️⃣  Colar no SQL Editor e clicar RUN" -ForegroundColor White
Write-Host ""
Write-Host "5️⃣  Voltar aqui e execute:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor DarkGray
Write-Host ""
Write-Host "6️⃣  Abrir: http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""
Write-Host "🎉 Seu bolão está pronto!" -ForegroundColor Green
Write-Host ""
