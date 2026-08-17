import { Component, Input, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MarcaService } from '../../core/services/marca.service';

/**
 * Assinatura visual do cliente: logo (ou ícone genérico) + nome.
 *
 * Existe para que nenhuma tela precise saber como a marca é montada. Antes o
 * par ícone+nome estava escrito à mão em cinco lugares — barra interna, barra
 * pública, login (duas vezes) e rodapé da home — cada um com sua variação. Num
 * produto white-label isso é justamente o que não pode ficar espalhado.
 *
 * `sobre` diz em que fundo o componente está, e decide qual logo usar e como
 * pintar o texto e o marcador de reserva. Não é o mesmo que o modo claro/escuro
 * do tema: a barra interna é da cor da marca (fundo escuro) mesmo no modo claro.
 */
@Component({
  selector: 'app-logo-marca',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2.5 min-w-0">
      @if (logo()) {
        <img [src]="logo()" [alt]="marca.nome()" [class]="classeImagem" class="object-contain shrink-0" />
      } @else {
        <span [class]="classeReserva" class="rounded-lg flex items-center justify-center shrink-0">
          <mat-icon [style.font-size.px]="tamanhoIcone" [style.width.px]="tamanhoIcone" [style.height.px]="tamanhoIcone">school</mat-icon>
        </span>
      }
      @if (mostrarNome) {
        <span [class]="classeTexto" class="font-bold truncate">{{ marca.nome() }}</span>
      }
    </span>
  `,
})
export class LogoMarcaComponent {
  readonly marca = inject(MarcaService);

  /** Fundo em que o logo será exibido — define a variante e as cores do texto. */
  @Input() sobre: 'claro' | 'marca' = 'claro';
  @Input() tamanho: 'sm' | 'md' | 'lg' = 'md';
  @Input() mostrarNome = true;

  /** Sobre a cor da marca usa a versão inversa; em fundo claro, a principal. */
  readonly logo = computed(() =>
    this.sobre === 'marca' ? this.marca.logoInversoEfetivo() : (this.marca.marca().logo || this.marca.logoInversoEfetivo()));

  private readonly alturas = { sm: 'h-7', md: 'h-9', lg: 'h-12' };
  private readonly caixas = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-12 h-12' };
  private readonly textos = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' };

  get classeImagem(): string {
    // max-w evita que um logo muito horizontal empurre o resto da barra.
    return `${this.alturas[this.tamanho]} max-w-[180px]`;
  }

  get classeReserva(): string {
    const cor = this.sobre === 'marca' ? 'bg-white/20 text-white' : 'bg-marca-suave text-marca';
    return `${this.caixas[this.tamanho]} ${cor}`;
  }

  get classeTexto(): string {
    const cor = this.sobre === 'marca' ? 'text-white' : 'text-texto';
    return `${this.textos[this.tamanho]} ${cor}`;
  }

  get tamanhoIcone(): number {
    return this.tamanho === 'sm' ? 16 : this.tamanho === 'lg' ? 28 : 20;
  }
}
