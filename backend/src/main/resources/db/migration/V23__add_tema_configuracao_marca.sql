-- Paleta e tipografia da instalação, ao lado do nome e dos logotipos.
--
-- Cores viviam só no localStorage, o que fazia delas preferência de cada
-- navegador: um administrador ajustava a identidade visual do cliente e nenhum
-- outro usuário via a mudança. Num produto white-label a paleta é parte da
-- marca — pertence à instalação, como o logotipo.
--
-- NULL é um estado válido e significativo: "nunca customizado, usar o padrão
-- de fábrica do produto". Isso evita duplicar aqui a paleta padrão que já vive
-- no frontend, e evita que uma futura mudança de padrão precise de migration
-- para alcançar quem nunca personalizou.
--
-- jsonb (e não text): o Postgres valida a sintaxe do JSON na escrita, então uma
-- linha corrompida é rejeitada pelo banco antes de chegar à desserialização.
ALTER TABLE configuracao_marca ADD COLUMN tema JSONB NULL;

COMMENT ON COLUMN configuracao_marca.tema IS
    'Paleta e tipografia dos modos claro e escuro. NULL = padrão de fábrica do produto. '
    'O modo ativo (claro/escuro/sistema) NÃO fica aqui: é preferência de cada usuário.';
