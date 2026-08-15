-- Busca textual no catálogo de cursos (GET /api/cursos?q=...).
--
-- Coluna gerada (STORED) em vez de calcular o tsvector em runtime na query: o
-- Postgres mantém o índice GIN atualizado a cada INSERT/UPDATE de titulo ou
-- descricao, sem custo de conversão a cada busca. Peso A no título, B na
-- descrição — ts_rank prioriza cursos cujo termo aparece no título.
ALTER TABLE cursos
    ADD COLUMN busca_tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('portuguese', coalesce(titulo, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(descricao, '')), 'B')
    ) STORED;

CREATE INDEX IF NOT EXISTS cursos_busca_tsv_idx ON cursos USING GIN (busca_tsv);
