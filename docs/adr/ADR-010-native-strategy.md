# ADR-010 — Estratégia nativa futura

- **Status:** Aceito (execução no G5)
- **Data:** 2026-10-08

## Contexto

Health Connect (Android) e HealthKit (iOS) não são acessíveis a partir de uma PWA. O Google Fit tem suporte só até o fim de 2026.

## Decisão

- Nada nativo até o G5.
- Quando houver integração com wearables: **shell Capacitor** sobre a mesma aplicação web, com plugins de Health Connect/HealthKit gravando `ExternalHealthRecord` (com `source` e `externalId` único para idempotência).
- Nenhuma integração com o Google Fit.

## Consequências

- O modelo de dados já prevê `source` em peso corporal e medidas, para receber dados externos sem retrabalho.
