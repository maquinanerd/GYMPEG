# ADR-006 — Object storage

- **Status:** Proposto (fornecedor a decidir)
- **Data:** 2026-10-08

## Contexto

Fotos de progresso ficam em disco local do container (`UPLOADS_DIR`), sem backup no Coolify e impedindo mais de uma réplica. Imagens de equipamento ficam em `bytea` no Postgres. A spec exige bucket S3-compatible privado, chaves UUID e signed URL curta.

## Decisão

- Interface `ObjectStorageProvider` (`put`, `get`, `delete`, `signedUrl`, `head`) em `lib/storage/`, com implementação S3 (AWS SDK v3, compatível com R2/S3/MinIO) e uma implementação em disco só para desenvolvimento e testes.
- **Dois buckets:**
  - `private`: fotos de progresso e mídia customizada do usuário. Acesso só por signed URL de curta duração emitida após checagem de posse.
  - `exercise-media`: mídia aprovada do catálogo. Leitura pública via CDN.
- Object key = UUID aleatório, nunca e-mail ou nome. Na entrada: remoção de EXIF, re-encode para WebP e thumbnail.
- Ambientes com buckets separados (dev, staging, prod).
- **Fornecedor recomendado: Cloudflare R2** (sem custo de egress, compatível com S3). Alternativa: MinIO no próprio Coolify, que fica no mesmo servidor e por isso não serve como cópia de backup.

## Consequências

- Migrar fotos existentes e `GymEquipment.imageData` para o bucket.
- Backups do Postgres também podem ir para um bucket R2 separado.
