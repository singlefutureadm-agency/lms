CREATE TABLE notificacoes (
    id             BIGSERIAL PRIMARY KEY,
    usuario_id     BIGINT       NOT NULL REFERENCES usuarios(id),
    tipo           VARCHAR(30)  NOT NULL,
    mensagem       TEXT         NOT NULL,
    referencia_id  BIGINT,
    lida           BOOLEAN      NOT NULL DEFAULT false,
    criado_em      TIMESTAMP    NOT NULL DEFAULT now()
);

-- Query mais comum: não lidas do usuário, mais recentes primeiro. Mesmo
-- espírito do índice parcial de cursos(criado_em DESC) WHERE ativo=true (V17).
CREATE INDEX IF NOT EXISTS notificacoes_usuario_lida_criado_em_idx
    ON notificacoes(usuario_id, lida, criado_em DESC);
