# ADR-006 — Object storage

- **Status:** Aceito; implementado para as fotos de progresso (fornecedor a configurar)
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

## Implementação (2026-10-09, G3)

- `lib/storage/s3.ts`: cliente S3 próprio (put, get, delete, list por prefixo) com assinatura SigV4 em `node:crypto`, sem SDK; validado com os exemplos oficiais da AWS. URLs path-style, compatível com R2, S3 e MinIO.
- `lib/storage/config.ts`: `STORAGE_PROVIDER=s3` com `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (`S3_REGION` padrão `auto`). Sem isso, disco local. Configuração pela metade é erro, nunca volta para o disco em silêncio.
- Fotos de progresso: chave `progress-photos/<userId>/<photoId>.<ext>` (ids gerados pelo servidor, validados antes de chegar ao bucket). Leitura sempre pela rota autenticada com checagem de posse; o bucket fica privado.
- Migração preguiçosa: com o bucket ativo, a foto que ainda está só no disco é copiada para o bucket na primeira leitura; excluir apaga nos dois lugares, inclusive na exclusão de conta.
- Metadados: EXIF/XMP/IPTC (GPS, câmera, data) removidos no upload de fotos e de imagens de equipamento (`lib/image-metadata.ts`), mantendo só a orientação no JPEG.
- Pendente: re-encode para WebP e miniatura (exige um codificador de imagem), signed URLs, `GymEquipment.imageData` ainda no Postgres, buckets por ambiente.
