-- Produtos configurados no admin para mapeamento de webhooks
CREATE TABLE IF NOT EXISTS webhook_products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  price       integer     NOT NULL DEFAULT 0, -- em centavos
  category_ids uuid[]     NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_products ENABLE ROW LEVEL SECURITY;

-- Somente admins gerenciam produtos
CREATE POLICY "admin_manage_webhook_products" ON webhook_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Acesso granular por categoria para cada usuário
CREATE TABLE IF NOT EXISTS user_category_access (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id       uuid        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  product_id        uuid        REFERENCES webhook_products(id) ON DELETE SET NULL,
  external_order_id text,
  granted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

ALTER TABLE user_category_access ENABLE ROW LEVEL SECURITY;

-- Usuário lê seus próprios acessos
CREATE POLICY "users_read_own_category_access" ON user_category_access
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins gerenciam todos
CREATE POLICY "admin_manage_category_access" ON user_category_access
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger para atualizar updated_at em webhook_products
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'webhook_products_updated_at'
  ) THEN
    CREATE TRIGGER webhook_products_updated_at
      BEFORE UPDATE ON webhook_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
