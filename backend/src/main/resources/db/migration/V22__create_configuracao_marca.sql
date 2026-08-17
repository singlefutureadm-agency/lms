-- Identidade visual do cliente (white-label): nome, assinatura e logotipos.
--
-- Antes isso vivia só no localStorage do navegador, junto com o tema. Para
-- nome e logotipo isso não serve: são configuração DA INSTALAÇÃO, não
-- preferência de quem está usando — cada administrador teria de reenviar o
-- logotipo em cada máquina, e o aluno veria a marca padrão.
--
-- Tabela de linha única. O CHECK trava o id em 1 para que não exista um
-- segundo registro concorrendo pelo papel de "a marca": sem ele, um INSERT
-- acidental criaria duas identidades e a leitura viraria uma escolha
-- arbitrária.
CREATE TABLE configuracao_marca (
    id               BIGINT       PRIMARY KEY,
    nome             VARCHAR(60)  NOT NULL,
    assinatura       VARCHAR(90),
    logo_url         VARCHAR(500),
    logo_inverso_url VARCHAR(500),
    atualizado_em    TIMESTAMP    NOT NULL,

    CONSTRAINT ck_configuracao_marca_singleton CHECK (id = 1)
);

-- A linha já nasce com o padrão de fábrica: assim a leitura nunca precisa
-- tratar "ainda não configurado", e a tela pública funciona desde o primeiro
-- boot, antes de qualquer administrador entrar.
INSERT INTO configuracao_marca (id, nome, assinatura, atualizado_em)
VALUES (1, 'LMS', 'Sistema de Gestão de Cursos', CURRENT_TIMESTAMP);
