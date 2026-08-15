import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { embedUrlPara, TipoVideoExterno } from './video-embed.util';

/**
 * Renderiza o embed de um vídeo de YouTube/Vimeo. `bypassSecurityTrustResourceUrl`
 * só é seguro porque `url`/`tipo` aqui sempre vêm de um ModuloRequest que já
 * passou pela validação de formato do backend (@ValidVideoModulo) — nunca
 * de input livre do usuário direto pro iframe.
 */
@Component({
    selector: 'app-video-embed',
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    @if (embedUrlSeguro) {
      <iframe [src]="embedUrlSeguro" title="Vídeo do módulo" loading="lazy" allowfullscreen
        class="w-full aspect-video rounded-xl border-0"></iframe>
    } @else {
      <p class="text-erro text-xs">Não foi possível carregar o vídeo: link inválido.</p>
    }
    `
})
export class VideoEmbedComponent {
  @Input() url: string | null = null;
  @Input() tipo: TipoVideoExterno = 'YOUTUBE';

  private sanitizer = inject(DomSanitizer);

  get embedUrlSeguro(): SafeResourceUrl | null {
    const embed = embedUrlPara(this.url, this.tipo);
    return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : null;
  }
}
