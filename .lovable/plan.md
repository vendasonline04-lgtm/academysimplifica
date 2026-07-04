## Objetivo

Atualizar apenas a URL do webhook exibida na interface de admin (campo copiável) para apontar para a Edge Function do Supabase.

## Mudança

Em `src/routes/_app/admin.tsx` (linhas 690-692), substituir:

```ts
const webhookUrl = typeof window !== "undefined"
  ? `${window.location.origin}/api/public/cackto/webhook`
  : "/api/public/cackto/webhook";
```

Por:

```ts
const webhookUrl = "https://lzfqofifjdzcqnglugrc.supabase.co/functions/v1/cackto-webhook";
```

## Escopo

- Apenas a string exibida/copiada no admin muda.
- O endpoint `/api/public/cackto/webhook` no app permanece intacto (sem remoção nem proxy).
- Nenhuma outra alteração de lógica, rotas ou backend.
