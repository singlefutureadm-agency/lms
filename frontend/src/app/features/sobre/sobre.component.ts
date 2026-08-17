import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { MarcaService } from '../../core/services/marca.service';
import { CursoService } from '../../core/services/curso.service';
import { LogoMarcaComponent } from '../../shared/logo-marca/logo-marca.component';

/**
 * Página institucional pública.
 *
 * Era a apresentação do projeto como portfólio — "Projeto de Portfólio",
 * "Sobre o LMS Lite", a stack tecnológica em selos coloridos, link para o
 * repositório no GitHub e três números inventados ("500+ alunos"). Nada disso
 * pode aparecer para o aluno de um cliente.
 *
 * O que ficou: o nome e a assinatura vindos da configuração de marca, e três
 * números reais lidos da API — se o cliente não cadastrou nada ainda, mostram
 * zero, que é honesto.
 */
@Component({
    selector: 'app-sobre',
    imports: [RouterLink, MatIconModule, LogoMarcaComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <div class="min-h-screen bg-superficie">

      <!-- Hero -->
      <section class="bg-gradient-to-br from-marca-profunda via-marca-escura to-marca py-20 lg:py-28">
        <div class="max-w-6xl mx-auto px-6 text-center">
          <div class="flex justify-center mb-6">
            <app-logo-marca sobre="marca" tamanho="lg" [mostrarNome]="false"></app-logo-marca>
          </div>
          <h1 class="text-4xl lg:text-5xl font-extrabold text-white mb-4">{{ marca.nome() }}</h1>
          @if (marca.assinatura()) {
            <p class="text-white/75 text-lg max-w-2xl mx-auto leading-relaxed">{{ marca.assinatura() }}</p>
          }
        </div>
      </section>

      <!-- Como funciona -->
      <section class="py-16 bg-superficie">
        <div class="max-w-4xl mx-auto px-6">
          <h2 class="text-3xl font-bold text-texto text-center mb-10">Como funciona</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @for (passo of passos; track passo.titulo) {
              <div class="text-center">
                <div class="w-14 h-14 bg-marca-suave rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <mat-icon class="text-marca">{{ passo.icone }}</mat-icon>
                </div>
                <h3 class="text-lg font-bold text-texto mb-2">{{ passo.titulo }}</h3>
                <p class="text-texto-suave text-sm leading-relaxed">{{ passo.texto }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Números reais -->
      <section class="py-14 bg-fundo">
        <div class="max-w-4xl mx-auto px-6">
          <h2 class="text-3xl font-bold text-texto text-center mb-10">Em números</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            @for (s of numeros(); track s.label) {
              <div class="bg-superficie rounded-2xl p-8 text-center shadow-md border border-borda hover:shadow-lg hover:-translate-y-1 transition-all">
                <div class="w-12 h-12 bg-marca-suave rounded-xl flex items-center justify-center mx-auto mb-4">
                  <mat-icon class="text-marca">{{ s.icone }}</mat-icon>
                </div>
                <div class="text-4xl font-extrabold text-marca mb-2">{{ s.valor }}</div>
                <div class="text-texto-suave font-medium">{{ s.label }}</div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-14 bg-gradient-to-br from-marca-profunda via-marca-escura to-marca">
        <div class="max-w-3xl mx-auto px-6 text-center">
          <h2 class="text-3xl font-bold text-white mb-4">Comece agora</h2>
          <p class="text-white/75 text-base mb-8 leading-relaxed">
            Crie sua conta e matricule-se nos cursos disponíveis.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a routerLink="/login"
              class="inline-flex items-center justify-center gap-2 bg-destaque hover:bg-destaque-escuro text-white font-bold px-8 py-3.5 rounded-xl transition-colors no-underline shadow-lg text-sm">
              <mat-icon style="font-size:20px;height:20px;width:20px">login</mat-icon>
              Acessar a plataforma
            </a>
            <a routerLink="/cursos"
              class="inline-flex items-center justify-center gap-2 border-2 border-white text-white hover:bg-white hover:text-marca-escura font-bold px-8 py-3.5 rounded-xl transition-all no-underline text-sm">
              <mat-icon style="font-size:20px;height:20px;width:20px">menu_book</mat-icon>
              Ver os cursos
            </a>
          </div>
        </div>
      </section>

    </div>
    `
})
export class SobreComponent implements OnInit {
  readonly marca = inject(MarcaService);
  private readonly cursoService = inject(CursoService);

  readonly passos = [
    { icone: 'search', titulo: 'Escolha o curso', texto: 'Navegue pelo catálogo por área, tipo de ensino ou unidade.' },
    { icone: 'how_to_reg', titulo: 'Matricule-se', texto: 'Crie sua conta e faça a matrícula em poucos cliques.' },
    { icone: 'workspace_premium', titulo: 'Conclua e certifique-se', texto: 'Acompanhe seu progresso por aula até a conclusão.' },
  ];

  readonly numeros = signal([
    { valor: '—', label: 'Cursos', icone: 'menu_book' },
    { valor: '—', label: 'Áreas', icone: 'category' },
    { valor: '—', label: 'Unidades', icone: 'location_city' },
  ]);

  ngOnInit(): void {
    forkJoin({
      cursos: this.cursoService.listarCursos(0),
      areas: this.cursoService.listarAreas(),
      unidades: this.cursoService.listarTodasUnidades(),
    }).subscribe({
      next: ({ cursos, areas, unidades }) => this.numeros.set([
        { valor: String(cursos.page.totalElements), label: 'Cursos', icone: 'menu_book' },
        { valor: String(areas.length), label: 'Áreas', icone: 'category' },
        { valor: String(unidades.length), label: 'Unidades', icone: 'location_city' },
      ]),
      // Sem rede, os traços iniciais continuam — melhor do que exibir zeros
      // que pareceriam dados reais.
      error: () => {},
    });
  }
}
