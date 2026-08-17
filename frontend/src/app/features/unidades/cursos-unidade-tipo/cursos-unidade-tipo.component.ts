import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { CursoService, Curso } from '../../../core/services/curso.service';
import { CursoCardComponent } from '../../../shared/curso-card/curso-card.component';

interface GrupoArea { areaNome: string; areaSlug: string; cursos: Curso[]; }
const PER_PAGE = 4;

@Component({
    selector: 'app-cursos-unidade-tipo',
    imports: [RouterLink, MatIconModule, MatProgressSpinnerModule, CursoCardComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <div class="min-h-screen bg-fundo">
    
      <!-- HERO -->
      <section class="bg-gradient-to-br from-marca-profunda via-marca-escura to-marca py-14">
        <div class="max-w-5xl mx-auto px-6">
          <div class="flex items-center flex-wrap gap-1.5 text-white/60 text-sm mb-6">
            <a routerLink="/home" class="hover:text-white no-underline text-white/60">Home</a>
            <mat-icon style="font-size:13px;height:13px;width:13px">chevron_right</mat-icon>
            <a routerLink="/unidades" class="hover:text-white no-underline text-white/60">Unidades</a>
            <mat-icon style="font-size:13px;height:13px;width:13px">chevron_right</mat-icon>
            <a [routerLink]="['/unidades', unidadeSlug()]" class="hover:text-white no-underline text-white/60">
              {{ unidadeNome() }}
            </a>
            <mat-icon style="font-size:13px;height:13px;width:13px">chevron_right</mat-icon>
            <span class="text-white/95">{{ tipoNome() }}</span>
          </div>
          <h1 class="text-3xl lg:text-4xl font-extrabold leading-tight">
            <span class="text-destaque">{{ tipoNome() }}</span>
            <span class="text-white"> em {{ unidadeNome() }}</span>
          </h1>
          @if (todosCursos().length) {
            <p class="text-white/75 mt-2">
              {{ todosCursos().length }} curso{{ todosCursos().length !== 1 ? 's' : '' }} disponíveis
            </p>
          }
        </div>
      </section>
    
      <!-- CHIPS DE ÁREA -->
      @if (areasDisponiveis().length > 0) {
        <section class="bg-superficie py-8 border-b border-borda">
          <div class="max-w-5xl mx-auto px-6">
            <div class="flex flex-wrap gap-2.5">
              <button (click)="selecionarArea(null)"
                class="px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all cursor-pointer"
              [class]="!areaSelecionada()
                ? 'bg-destaque border-destaque text-white'
                : 'bg-superficie border-gray-300 text-texto-suave hover:border-destaque hover:text-destaque'">
                Todos
              </button>
              @for (area of areasDisponiveis(); track area) {
                <button
                  (click)="selecionarArea(area.slug)"
                  class="px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all cursor-pointer"
              [class]="areaSelecionada() === area.slug
                ? 'bg-destaque border-destaque text-white'
                : 'bg-superficie border-gray-300 text-texto-suave hover:border-destaque hover:text-destaque'">
                  {{ area.nome }}
                </button>
              }
            </div>
          </div>
        </section>
      }
    
      @if (loading()) {
        <div class="flex justify-center py-24">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }
    
      @if (!loading()) {
        <section class="max-w-5xl mx-auto px-6 py-10 space-y-12">
          @if (gruposVisiveis().length === 0) {
            <div class="text-center py-16">
              <mat-icon class="text-gray-200" style="font-size:64px;height:64px;width:64px">search_off</mat-icon>
              <p class="text-texto-suave mt-4">Nenhum curso encontrado.</p>
            </div>
          }
          @for (grupo of gruposVisiveis(); track grupo) {
            <div>
              <h2 class="text-lg font-bold text-texto mb-4">
                <a [routerLink]="['/unidades', unidadeSlug(), 'areas', grupo.areaSlug]"
                  class="text-marca hover:underline no-underline">
                  {{ grupo.areaNome }}
                </a>
                <span class="text-texto-suave font-normal text-sm ml-2">({{ grupo.cursos.length }})</span>
              </h2>
              <!-- Mobile scroll -->
              <div class="flex gap-4 overflow-x-auto pb-3 lg:hidden snap-x snap-mandatory -mx-6 px-6">
                @for (c of grupo.cursos; track c) {
                  <div class="shrink-0 snap-start" style="width:240px">
                    <app-curso-card [curso]="c"></app-curso-card>
                  </div>
                }
              </div>
              <!-- Desktop carousel -->
              <div class="hidden lg:flex items-center gap-2">
                <button (click)="prev(grupo.areaSlug)"
                  [disabled]="getPage(grupo.areaSlug) === 0"
                  [class.opacity-30]="getPage(grupo.areaSlug) === 0"
              class="shrink-0 w-9 h-9 rounded-full border border-gray-300 bg-superficie flex items-center
                     justify-center hover:bg-superficie-2 transition-colors cursor-pointer">
                  <mat-icon style="font-size:20px;height:20px;width:20px">chevron_left</mat-icon>
                </button>
                <div class="flex-1 grid grid-cols-4 gap-4">
                  @for (c of cursosVisiveis(grupo.cursos, grupo.areaSlug); track c) {
                    <app-curso-card [curso]="c"></app-curso-card>
                  }
                </div>
                <button (click)="next(grupo.areaSlug, grupo.cursos.length)"
                  [disabled]="(getPage(grupo.areaSlug) + 1) * 4 >= grupo.cursos.length"
                  [class.opacity-30]="(getPage(grupo.areaSlug) + 1) * 4 >= grupo.cursos.length"
              class="shrink-0 w-9 h-9 rounded-full border border-gray-300 bg-superficie flex items-center
                     justify-center hover:bg-superficie-2 transition-colors cursor-pointer">
                  <mat-icon style="font-size:20px;height:20px;width:20px">chevron_right</mat-icon>
                </button>
              </div>
            </div>
          }
        </section>
      }
    </div>
    `
})
export class CursosUnidadeTipoComponent implements OnInit {
  private cursoService = inject(CursoService);
  private route = inject(ActivatedRoute);

  unidadeSlug = signal('');
  unidadeNome = signal('');
  tipoSlug = signal('');
  tipoNome = signal('');
  todosCursos = signal<Curso[]>([]);
  loading = signal(true);
  areaSelecionada = signal<string | null>(null);
  pages = signal<Record<string, number>>({});

  areasDisponiveis = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.todosCursos()) {
      const s = c.categorias[0]?.areaSlug;
      const n = c.categorias[0]?.areaNome;
      if (s && n) map.set(s, n);
    }
    return [...map.entries()].map(([slug, nome]) => ({ slug, nome }));
  });

  gruposVisiveis = computed((): GrupoArea[] => {
    const areaSel = this.areaSelecionada();
    const map = new Map<string, GrupoArea>();
    for (const c of this.todosCursos()) {
      const aNome = c.categorias[0]?.areaNome ?? 'Outras';
      const aSlug = c.categorias[0]?.areaSlug ?? 'outras';
      if (!map.has(aSlug)) map.set(aSlug, { areaNome: aNome, areaSlug: aSlug, cursos: [] });
      map.get(aSlug)!.cursos.push(c);
    }
    const all = [...map.values()];
    return areaSel ? all.filter(g => g.areaSlug === areaSel) : all;
  });

  ngOnInit() {
    const uSlug = this.route.snapshot.paramMap.get('unidadeSlug')!;
    const tSlug = this.route.snapshot.paramMap.get('tipoSlug')!;
    this.unidadeSlug.set(uSlug);
    this.tipoSlug.set(tSlug);

    forkJoin({
      unidade: this.cursoService.buscarUnidade(uSlug),
      tipos: this.cursoService.listarTipos(),
      cursos: this.cursoService.listarCursosDaUnidade(uSlug, { tipoSlug: tSlug })
    }).subscribe({
      next: ({ unidade, tipos, cursos }) => {
        this.unidadeNome.set(unidade.nome);
        const t = tipos.find(t => t.slug === tSlug);
        this.tipoNome.set(t?.nome ?? this.slugLabel(tSlug));
        this.todosCursos.set(cursos.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  selecionarArea(slug: string | null) { this.areaSelecionada.set(slug); this.pages.set({}); }
  getPage(areaSlug: string): number { return this.pages()[areaSlug] ?? 0; }

  cursosVisiveis(cursos: Curso[], areaSlug: string): Curso[] {
    const p = this.pages()[areaSlug] ?? 0;
    return cursos.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
  }

  next(areaSlug: string, total: number) {
    const p = this.getPage(areaSlug);
    if ((p + 1) * PER_PAGE < total) this.pages.update(m => ({ ...m, [areaSlug]: p + 1 }));
  }

  prev(areaSlug: string) {
    const p = this.getPage(areaSlug);
    if (p > 0) this.pages.update(m => ({ ...m, [areaSlug]: p - 1 }));
  }

  private slugLabel(slug: string) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
