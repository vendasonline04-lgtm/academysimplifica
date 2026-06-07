-- Sistema de pesquisas para alunos
CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'text',
  options jsonb,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  rating text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  answer_text text
);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

-- surveys: ativas visíveis a autenticados; admin vê todas
CREATE POLICY "surveys_read" ON surveys FOR SELECT TO authenticated USING (
  is_active = true
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "surveys_insert" ON surveys FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "surveys_update" ON surveys FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "surveys_delete" ON surveys FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- perguntas: leitura autenticada; escrita admin
CREATE POLICY "questions_read" ON survey_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_insert" ON survey_questions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "questions_update" ON survey_questions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "questions_delete" ON survey_questions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- respostas: aluno insere/lê as próprias; admin lê todas
CREATE POLICY "responses_insert" ON survey_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "responses_read_own" ON survey_responses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "responses_read_admin" ON survey_responses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- respostas individuais
CREATE POLICY "answers_insert" ON survey_answers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM survey_responses WHERE id = response_id AND user_id = auth.uid())
);
CREATE POLICY "answers_read_own" ON survey_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM survey_responses WHERE id = response_id AND user_id = auth.uid())
);
CREATE POLICY "answers_read_admin" ON survey_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
