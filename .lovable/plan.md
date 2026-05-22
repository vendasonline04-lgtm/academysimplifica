
# Academy — Plataforma de Área de Membros

Plataforma de cursos em vídeo conectada ao seu Supabase externo, com auth email/senha, controle de acesso por tier (free/basic/premium) e painel administrativo.

## Stack e integrações

- TanStack Start + TanStack Router + React Query (já configurados).
- `@supabase/supabase-js` (a instalar) + `embla-carousel-react` para carrosséis.
- Cliente em `src/lib/supabase.ts` lendo `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` (NÃO hardcoded). Adicionarei essas duas variáveis via tool de secrets antes de qualquer código.
- Tipos do banco em `src/lib/database.types.ts` (escritos manualmente a partir do schema informado).
- Queries direto do client → Supabase (RLS já está no banco). Sem `createServerFn`, sem Lovable Cloud.
- Buckets `covers` (público) e `lesson-files` (privado) — assumidos prontos. Recursos privados acessados via `createSignedUrl`.

## Design system (`src/styles.css`)

- `--primary: oklch(0.55 0.27 305)` + `--primary-glow`, `--radius: 0.875rem`.
- Fundo claro `oklch(0.99 0.005 305)`, dark escuro violeta.
- Tokens extras: `--gradient-primary`, `--shadow-glow`, `--glass-bg`, `--glass-border`.
- Fontes Space Grotesk (headings) + Inter (body) via Google Fonts no `__root.tsx`.
- Utilitários `.glass-card`, variant de botão `hero` (gradiente + glow).

## Rotas (file-based)

```
src/routes/
  __root.tsx
  index.tsx                 # / landing
  auth.tsx                  # /auth
  _app.tsx                  # layout autenticado + guard
  _app/dashboard.tsx
  _app/modulos.$id.tsx      # /modulos/:id?aula=<lessonId>
  _app/favoritos.tsx
  _app/historico.tsx
  _app/suporte.tsx
  _app/upgrade.tsx
  _app/admin.tsx
```

- `_app.tsx`: `beforeLoad` → `supabase.auth.getUser()`; sem sessão redireciona `/auth`.
- `/admin`: gate extra com `has_role(uid, 'admin')`.
- `/modulos/:id` usa search param tipado via `zodValidator` (`?aula=<uuid>`).

## Componentes principais

- Layout: `AppSidebar`, `Header` (avatar, tier badge, logout).
- Conteúdo: `ModuleCarousel` (embla), `LessonCard`, `LockOverlay`.
- Player: `VideoPlayer` (iframe `panda_embed_url`), `LessonComments`, `LessonResources` (signed URLs do bucket `lesson-files`), `FavoriteButton`, `CompleteButton`.
- Admin: `ContentManager` (árvore Categoria→Módulo→Aula, reorder por setas via `order_index`, upload de capa no bucket `covers`), `SubscriptionsManager` (tabela + edição de tier/status), `StructureView` (diagrama hierárquico).
- Auth: `AuthForm`.

## Páginas (resumo)

- **Landing (`/`)** — hero centralizado, badge "Acesso Exclusivo", título grande, 2 CTAs, blobs desfocados.
- **Auth (`/auth`)** — toggle login/cadastro, `signInWithPassword`/`signUp` com `emailRedirectTo` para `/dashboard`.
- **Dashboard** — categorias → módulos em carrossel; aplica tier e `unlock_delay_days`.
- **Módulo/Aula (`/modulos/:id?aula=`)** — lista lateral de aulas + player + descrição + recursos + comentários + favorito + concluir.
- **Favoritos / Histórico** — grids filtrando por `user_id`.
- **Suporte** — texto + mailto.
- **Upgrade** — 3 cards (Free, Básico, Premium), botão "Assinar" placeholder.
- **Admin** — Tabs: Conteúdo / Assinaturas / Visualização.

## Regras de negócio (client-side; RLS no backend)

- Hook `useCurrentUser()` retorna `{ user, tier, isAdmin, subscription }` cacheado.
- Tier via RPC `get_user_tier(auth.uid())`; bloqueio via `tier_allows`.
- Unlock delay: `Date.now() - subscription.created_at >= unlock_delay_days * 86400000`.
- Conteúdo bloqueado → cadeado + redirect `/upgrade`.
- Trigger `handle_new_user` no banco cuida de profile/subscription/primeiro admin.
- Comentários: sem realtime, refetch ao postar.

## Tarefas de implementação

1. Adicionar secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` via tool.
2. Instalar `@supabase/supabase-js` e `embla-carousel-react`.
3. Criar `src/lib/supabase.ts` + `database.types.ts`.
4. Atualizar `src/styles.css` (design system roxo + glass + fontes).
5. Criar `AuthProvider` + hook `useCurrentUser`.
6. Criar layout `_app.tsx` (sidebar + guard) e `Header`.
7. Implementar páginas públicas (landing, auth).
8. Implementar páginas autenticadas (dashboard, módulo, favoritos, histórico, suporte, upgrade).
9. Implementar `/admin` (3 abas + CRUD hierárquico + uploads).
10. Polimento: skeletons, toasts, empty states, SEO por rota.
