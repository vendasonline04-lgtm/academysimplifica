-- Adiciona chave secreta por produto para validação de webhook da Cackto
ALTER TABLE webhook_products
  ADD COLUMN IF NOT EXISTS cackto_secret text;