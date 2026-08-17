import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { CursoService, Regiao, Unidade } from '../../core/services/curso.service';

interface GrupoRegiao {
  regiao: Regiao;
  unidades: Unidade[];
}

@Component({
    selector: 'app-unidades',
    imports: [RouterLink, MatIconModule, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <div class="min-h-screen bg-superficie">
    
      <!-- Hero -->
      <section class="bg-gradient-to-br from-marca-profunda via-marca-escura to-marca py-16 lg:py-20">
        <div class="max-w-6xl mx-auto px-6 text-center">
          <span class="inline-block bg-white/10 text-white/75 text-xs font-semibold uppercase
                       tracking-widest px-4 py-1.5 rounded-full mb-5">
            Estado de São Paulo
          </span>
          <h1 class="text-4xl lg:text-5xl font-extrabold text-white mb-4">Nossas Unidades</h1>
          <p class="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
            Encontre a unidade mais próxima de você e comece sua jornada de aprendizado profissional.
          </p>
        </div>
      </section>
    
      <!-- Loading -->
      @if (loading()) {
        <div class="flex justify-center py-24">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }
    
      <!-- Seções por região -->
      @if (!loading()) {
        @for (grupo of grupos(); track grupo) {
          <section
            [id]="'regiao-' + grupo.regiao.id"
            class="py-12 border-b border-borda last:border-0"
            [class.bg-fundo]="isRegiaoAtiva(grupo.regiao.id)">
            <div class="max-w-6xl mx-auto px-6">
              <!-- Título da região -->
              <div class="flex items-baseline gap-3 mb-8">
                <h2 class="text-2xl font-bold text-texto">{{ grupo.regiao.nome }}</h2>
                <span class="text-sm text-texto-suave font-medium">
                  {{ grupo.unidades.length }} unidade{{ grupo.unidades.length !== 1 ? 's' : '' }}
                </span>
              </div>
              <!-- Grid de unidades -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                @for (u of grupo.unidades; track u) {
                  <div
                    [id]="'unidade-' + u.id"
                    class="bg-superficie rounded-2xl border transition-all duration-200 p-5 flex flex-col gap-3"
                   [class]="isUnidadeAtiva(u.id)
                     ? 'border-marca shadow-lg ring-2 ring-marca/20'
                     : 'border-borda shadow-xs hover:shadow-md hover:-translate-y-0.5'">
                    <!-- Badge destaque -->
                    @if (isUnidadeAtiva(u.id)) {
                      <div
                        class="self-start bg-marca text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        Unidade selecionada
                      </div>
                    }
                    <div class="flex items-start gap-3">
                      <div class="w-9 h-9 bg-marca-suave rounded-xl flex items-center justify-center shrink-0">
                        <mat-icon class="text-marca" style="font-size:18px;height:18px;width:18px">
                          location_city
                        </mat-icon>
                      </div>
                      <div class="min-w-0">
                        <h3 class="font-bold text-texto text-sm leading-snug">{{ u.nome }}</h3>
                        @if (u.endereco) {
                          <p class="text-texto-suave text-xs mt-1 leading-relaxed">
                            {{ u.endereco }}
                          </p>
                        }
                        @if (!u.endereco) {
                          <p class="text-texto-suave text-xs mt-1">
                            {{ grupo.regiao.nome }}
                          </p>
                        }
                      </div>
                    </div>
                    <a [routerLink]="['/unidades', u.slug]"
                   class="self-start inline-flex items-center gap-1.5 text-marca text-xs
                          font-semibold hover:underline no-underline mt-auto">
                      <mat-icon style="font-size:14px;height:14px;width:14px">school</mat-icon>
                      Ver cursos
                    </a>
                  </div>
                }
              </div>
            </div>
          </section>
        }
      }
    
      <!-- Empty state -->
      @if (!loading() && grupos().length === 0) {
        <div
          class="py-24 text-center text-texto-suave">
          <mat-icon style="font-size:48px;height:48px;width:48px" class="mb-4 opacity-40">
            location_off
          </mat-icon>
          <p class="text-lg font-medium">Nenhuma unidade encontrada.</p>
        </div>
      }
    
      <!-- CTA -->
      <section class="py-14 bg-gradient-to-br from-marca-profunda via-marca-escura to-marca">
        <div class="max-w-3xl mx-auto px-6 text-center">
          <h2 class="text-3xl font-bold text-white mb-4">Estude de onde quiser</h2>
          <p class="text-white/75 text-base mb-8 leading-relaxed">
            Matricule-se online e acesse os cursos de qualquer unidade ou pelo conforto da sua casa.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a routerLink="/login"
               class="inline-flex items-center justify-center gap-2 bg-destaque hover:bg-destaque-escuro
                      text-white font-bold px-8 py-3.5 rounded-xl transition-colors no-underline
                      shadow-lg text-sm">
              <mat-icon style="font-size:20px;height:20px;width:20px">school</mat-icon>
              Matricule-se agora
            </a>
            <a routerLink="/cursos/areas"
               class="inline-flex items-center justify-center gap-2 border-2 border-white text-white
                      hover:bg-white hover:text-marca-escura font-bold px-8 py-3.5 rounded-xl
                      transition-all no-underline text-sm">
              Ver cursos disponíveis
            </a>
          </div>
        </div>
      </section>
    
    </div>
    `
})
export class UnidadesComponent implements OnInit {
  private cursoService = inject(CursoService);
  private route = inject(ActivatedRoute);

  regioes = signal<Regiao[]>([]);
  todasUnidades = signal<Unidade[]>([]);
  loading = signal(true);
  selectedUnidadeId = signal<number | null>(null);
  selectedRegiaoId = signal<number | null>(null);

  private readonly REGIAO_ORDER = ['Capital', 'Grande São Paulo e Litoral', 'Interior', 'Centros Universitários'];

  grupos = computed<GrupoRegiao[]>(() => {
    const regioes = this.regioes().filter(r => !r.nome.startsWith('Regiao ') && r.totalUnidades > 0);
    const unidades = this.todasUnidades();

    const ordered = this.REGIAO_ORDER
      .map(nome => regioes.find(r => r.nome === nome))
      .filter((r): r is Regiao => !!r);

    const others = regioes.filter(r => !this.REGIAO_ORDER.includes(r.nome));

    return [...ordered, ...others].map(r => ({
      regiao: r,
      unidades: unidades.filter(u => u.regiaoId === r.id)
    })).filter(g => g.unidades.length > 0);
  });

  ngOnInit() {
    forkJoin({
      regioes: this.cursoService.listarRegioes(),
      unidades: this.cursoService.listarTodasUnidades()
    }).subscribe({
      next: ({ regioes, unidades }) => {
        this.regioes.set(regioes);
        this.todasUnidades.set(unidades);
        this.loading.set(false);
        this.scrollAfterLoad();
      },
      error: () => this.loading.set(false)
    });

    this.route.queryParams.subscribe(params => {
      this.selectedUnidadeId.set(params['unidadeId'] ? Number(params['unidadeId']) : null);
      this.selectedRegiaoId.set(params['regiaoId'] ? Number(params['regiaoId']) : null);
    });
  }

  isUnidadeAtiva(id: number): boolean {
    return this.selectedUnidadeId() === id;
  }

  isRegiaoAtiva(id: number): boolean {
    return this.selectedRegiaoId() === id;
  }

  private scrollAfterLoad() {
    setTimeout(() => {
      const uid = this.selectedUnidadeId();
      const rid = this.selectedRegiaoId();
      if (uid) {
        document.getElementById(`unidade-${uid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (rid) {
        document.getElementById(`regiao-${rid}`)?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  }
}
