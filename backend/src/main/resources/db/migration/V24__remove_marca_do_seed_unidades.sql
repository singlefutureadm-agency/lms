-- Remove a marca do cliente original dos dados de exemplo.
--
-- O seed da V12 cadastra 64 unidades. As três dos Centros Universitários eram
-- as únicas que traziam o nome da instituição embutido — as demais são apenas
-- nomes de bairro/cidade, que funcionam como dado de demonstração para
-- qualquer cliente. Num produto white-label, um nome de instituição no dado de
-- exemplo aparece no menu público como se fosse a unidade do cliente.
--
-- Feito em migration nova, e não editando a V12/V14: alterar um arquivo já
-- aplicado muda o checksum e faz o Flyway falhar a validação em toda
-- instalação existente.
--
-- O slug acompanha o nome porque é o identificador da rota pública
-- (/api/unidades/{slug}) — deixá-lo desatualizado manteria a marca antiga
-- visível na URL. Links antigos para estas três unidades deixam de funcionar;
-- é aceitável em dado de exemplo, e é o mesmo efeito de renomear a unidade
-- pelo painel.
UPDATE unidades SET nome = 'Centro Universitário - Santo Amaro',
                    slug = 'centro-universitario-santo-amaro'
 WHERE nome = 'Centro Universitário Senac - Santo Amaro';

UPDATE unidades SET nome = 'Centro Universitário - Águas de São Pedro',
                    slug = 'centro-universitario-aguas-de-sao-pedro'
 WHERE nome = 'Centro Universitário Senac - Águas de São Pedro';

UPDATE unidades SET nome = 'Centro Universitário - Campos do Jordão',
                    slug = 'centro-universitario-campos-do-jordao'
 WHERE nome = 'Centro Universitário Senac - Campos do Jordão';
