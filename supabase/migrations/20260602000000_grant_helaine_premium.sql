-- Grant premium subscription to helaine.cris@hotmail.com
-- This is the platform owner's personal account for reviewing content
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'helaine.cris@hotmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = v_user_id) THEN
      INSERT INTO user_subscriptions (user_id, tier, status, payment_provider, started_at)
      VALUES (v_user_id, 'premium', 'active', 'manual', NOW());
    ELSE
      UPDATE user_subscriptions
      SET tier = 'premium', status = 'active'
      WHERE user_id = v_user_id;
    END IF;
  END IF;
END $$;
