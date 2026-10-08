# Política de segurança

## Reportar uma vulnerabilidade

Não abra issue pública para problemas de segurança. Use o reporte privado de vulnerabilidades do GitHub ("Report a vulnerability" na aba Security de https://github.com/maquinanerd/GYMPEG).

## Notas de operação

GYM Peg lida com dados pessoais sensíveis (peso, medidas, fotos corporais). Em produção:

- `JWT_SECRET` forte e único (mínimo 32 caracteres), fora do repositório.
- Chaves de provedores de IA mantidas em segredo. O coach de IA envia um contexto compacto e estruturado do treino do usuário ao provedor configurado; nunca o banco bruto.
- HTTPS obrigatório (Coolify/Traefik termina TLS).
- PostgreSQL sem porta pública, com backup agendado e teste de restauração.
- Fotos de progresso apenas em storage privado com acesso autenticado ou URL assinada de curta duração.
- Dependências atualizadas (`npm audit`).
