import { detectarTipoVideo, extrairIdVideo, embedUrlPara } from './video-embed.util';

describe('video-embed.util', () => {
  describe('detectarTipoVideo', () => {
    it('reconhece link padrão do YouTube (watch?v=)', () => {
      expect(detectarTipoVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('YOUTUBE');
    });

    it('reconhece link curto do YouTube (youtu.be)', () => {
      expect(detectarTipoVideo('https://youtu.be/dQw4w9WgXcQ')).toBe('YOUTUBE');
    });

    it('reconhece link do Vimeo', () => {
      expect(detectarTipoVideo('https://vimeo.com/123456789')).toBe('VIMEO');
    });

    it('reconhece Vimeo sem www', () => {
      expect(detectarTipoVideo('https://vimeo.com/76979871')).toBe('VIMEO');
    });

    it('rejeita link de outro site', () => {
      expect(detectarTipoVideo('https://exemplo.com/video')).toBeNull();
    });

    it('rejeita vazio/nulo', () => {
      expect(detectarTipoVideo('')).toBeNull();
      expect(detectarTipoVideo(null)).toBeNull();
      expect(detectarTipoVideo(undefined)).toBeNull();
    });
  });

  describe('extrairIdVideo', () => {
    it('extrai o id de um link do YouTube', () => {
      expect(extrairIdVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YOUTUBE')).toBe('dQw4w9WgXcQ');
    });

    it('extrai o id de um link curto do YouTube', () => {
      expect(extrairIdVideo('https://youtu.be/dQw4w9WgXcQ', 'YOUTUBE')).toBe('dQw4w9WgXcQ');
    });

    it('extrai o id de um link do Vimeo', () => {
      expect(extrairIdVideo('https://vimeo.com/123456789', 'VIMEO')).toBe('123456789');
    });

    it('retorna null se não encontrar o id', () => {
      expect(extrairIdVideo('https://exemplo.com/video', 'YOUTUBE')).toBeNull();
    });
  });

  describe('embedUrlPara', () => {
    it('monta a url de embed do YouTube', () => {
      expect(embedUrlPara('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YOUTUBE'))
        .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('monta a url de embed do Vimeo', () => {
      expect(embedUrlPara('https://vimeo.com/123456789', 'VIMEO'))
        .toBe('https://player.vimeo.com/video/123456789');
    });

    it('retorna null pra link malformado', () => {
      expect(embedUrlPara('https://exemplo.com/video', 'YOUTUBE')).toBeNull();
    });
  });
});
