-- Tipo do vídeo do módulo: upload local (ARQUIVO) ou embed de link externo
-- (YOUTUBE/VIMEO). Nullable, sem default: módulo sem vídeo continua normal.
ALTER TABLE modulos ADD COLUMN tipo_video VARCHAR(20) NULL;

-- Módulos que já tinham url_video preenchida (só possível hoje via upload
-- local, ver V20) recebem ARQUIVO, para não deixar dado existente com
-- url_video setada mas tipo_video nula.
UPDATE modulos SET tipo_video = 'ARQUIVO' WHERE url_video IS NOT NULL;
