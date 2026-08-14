-- Vídeo do módulo (upload direto), separado do vídeo por aula (url_video em
-- aulas, hoje só preenchido via link externo). Nullable, sem default: módulo
-- sem vídeo continua normal.
ALTER TABLE modulos ADD COLUMN url_video VARCHAR(500) NULL;
