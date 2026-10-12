#!/bin/sh
# Gera o certificado autoassinado do ambiente de desenvolvimento (RNF02;
# especificacao, decisao 9.5). Nao sobrescreve um certificado existente,
# a menos que receba -f. Os arquivos gerados nao sao versionados.
#
# Nomes alternativos: localhost e 127.0.0.1 (maquina de desenvolvimento) e
# 10.0.2.2 (endereco do hospedeiro visto pelo emulador Android).

set -e

DIRETORIO="${CERT_DIR:-certs}"
CHAVE="$DIRETORIO/servidor.key"
CERTIFICADO="$DIRETORIO/servidor.crt"

if [ -f "$CHAVE" ] && [ -f "$CERTIFICADO" ] && [ "$1" != "-f" ]; then
  echo "Certificado existente mantido em $DIRETORIO"
  exit 0
fi

mkdir -p "$DIRETORIO"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
  -keyout "$CHAVE" -out "$CERTIFICADO" \
  -subj "/CN=equilog-desenvolvimento" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:10.0.2.2" 2>/dev/null
chmod 644 "$CHAVE" "$CERTIFICADO"
echo "Certificado gerado em $DIRETORIO"
