/**
 * Extração de ID e montagem da URL de embed pra links de YouTube/Vimeo —
 * função pura, sem depender do Angular, pra ficar testável sem TestBed e não
 * virar regex solta espalhada pelo template/component.
 *
 * Os padrões de detecção espelham exatamente os do backend
 * (ModuloRequestVideoValidator), pra validação client-side e server-side
 * concordarem sobre o que é um link válido.
 */

export type TipoVideoExterno = 'YOUTUBE' | 'VIMEO';

const YOUTUBE_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
const VIMEO_RE = /^https?:\/\/(www\.)?vimeo\.com\/\d+/;

const YOUTUBE_ID_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
const VIMEO_ID_RE = /vimeo\.com\/(\d+)/;

/** Detecta se a URL é um link válido de YouTube, Vimeo, ou nenhum dos dois. */
export function detectarTipoVideo(url: string | null | undefined): TipoVideoExterno | null {
  if (!url) return null;
  if (YOUTUBE_RE.test(url)) return 'YOUTUBE';
  if (VIMEO_RE.test(url)) return 'VIMEO';
  return null;
}

/** Extrai o ID do vídeo da URL, dado o tipo já detectado. */
export function extrairIdVideo(url: string | null | undefined, tipo: TipoVideoExterno): string | null {
  if (!url) return null;
  const match = tipo === 'YOUTUBE' ? url.match(YOUTUBE_ID_RE) : url.match(VIMEO_ID_RE);
  return match ? match[1] : null;
}

/** Monta a URL de embed (iframe src) a partir da URL original + tipo. Null se a URL não bater no padrão esperado. */
export function embedUrlPara(url: string | null | undefined, tipo: TipoVideoExterno): string | null {
  const id = extrairIdVideo(url, tipo);
  if (!id) return null;
  return tipo === 'YOUTUBE'
    ? `https://www.youtube.com/embed/${id}`
    : `https://player.vimeo.com/video/${id}`;
}
