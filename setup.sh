#!/bin/bash

# ========================================
# Setup Bolão Copa 2026
# Sem clone - apenas configuração local
# ========================================

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  BOLÃO COPA DO MUNDO 2026 - SETUP      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    echo "   Instale em: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js encontrado"
echo ""

# Pedir informações
echo "📝 Suas credenciais Supabase"
echo "   (encontre em: https://seu-projeto.supabase.co/settings/api)"
echo ""

read -p "URL do Supabase: " url
if [ -z "$url" ]; then
    echo "❌ URL necessária"
    exit 1
fi

read -p "Anon Key: " key
if [ -z "$key" ]; then
    echo "❌ Anon Key necessária"
    exit 1
fi

echo ""
echo "⏳ Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo "✅ Dependências instaladas"
echo ""

# Criar .env.local
echo "🔐 Criando configuração..."
cat > .env.local << EOF
VITE_SUPABASE_URL=$url
VITE_SUPABASE_ANON_KEY=$key
EOF

echo "✅ Arquivo .env.local criado"

echo ""
echo "════════════════════════════════════════"
echo "✅ SETUP CONCLUÍDO!"
echo "════════════════════════════════════════"
echo ""

echo "📌 PRÓXIMO PASSO:"
echo ""
echo "1️⃣  Abrir Supabase:"
echo "   https://seu-projeto.supabase.co"
echo ""
echo "2️⃣  Ir em: Database → SQL Editor"
echo ""
echo "3️⃣  Copiar TODO o conteúdo de: schema-clean.sql"
echo ""
echo "4️⃣  Colar no SQL Editor e clicar RUN"
echo ""
echo "5️⃣  Voltar aqui e execute:"
echo "   npm run dev"
echo ""
echo "6️⃣  Abrir: http://localhost:5173"
echo ""
echo "🎉 Seu bolão está pronto!"
echo ""
