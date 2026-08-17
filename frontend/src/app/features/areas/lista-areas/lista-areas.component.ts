import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CursoService, Area } from '../../../core/services/curso.service';

const AREA_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  'tecnologia-da-informacao':  { icon: 'computer',         color: 'text-marca',   bg: 'bg-marca/12',    border: 'border-marca/30' },
  'gestao-e-negocios':         { icon: 'business_center',  color: 'text-marca-escura', bg: 'bg-marca-suave', border: 'border-marca-suave' },
  'saude':                     { icon: 'local_hospital',   color: 'text-erro',    bg: 'bg-erro/12',     border: 'border-erro/30' },
  'gastronomia-e-alimentacao': { icon: 'restaurant',       color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' },
  'design-artes-e-arquitetura':{ icon: 'palette',          color: 'text-destaque', bg: 'bg-destaque/12', border: 'border-destaque/30' },
  'idiomas':                   { icon: 'translate',        color: 'text-teal-700',   bg: 'bg-teal-100',   border: 'border-teal-200' },
  'educacao':                  { icon: 'school',           color: 'text-sucesso',bg: 'bg-sucesso/12',  border: 'border-sucesso/30' },
  'comunicacao-e-marketing':   { icon: 'campaign',         color: 'text-cyan-700',   bg: 'bg-cyan-100',   border: 'border-cyan-200' },
  'beleza-e-estetica':         { icon: 'spa',              color: 'text-pink-700',   bg: 'bg-pink-100',   border: 'border-pink-200' },
  'turismo-e-hospitalidade':   { icon: 'hotel',            color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-200' },
};

@Component({
    selector: 'app-lista-areas',
    imports: [CommonModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <div class="min-h-screen bg-fundo">
    
      <!-- Hero -->
      <section class="bg-gradient-to-br from-marca-profunda via-marca-escura to-marca py-14 lg:py-20">
        <div class="max-w-6xl mx-auto px-6 text-center">
          <span class="inline-block bg-white/10 text-white/75 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
            Catálogo
          </span>
          <h1 class="text-4xl lg:text-5xl font-extrabold text-white mb-3">Explorar por Área</h1>
          <p class="text-white/75 text-lg max-w-xl mx-auto">
            Escolha uma área de interesse e descubra todas as categorias e cursos disponíveis.
          </p>
        </div>
      </section>
    
      <!-- Grid de áreas -->
      <section class="py-14">
        <div class="max-w-6xl mx-auto px-6">
    
          @if (loading()) {
            <div class="flex justify-center py-20">
              <mat-spinner diameter="48"></mat-spinner>
            </div>
          }
    
          @if (!loading()) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              @for (area of areas(); track area) {
                <a
                  [routerLink]="['/cursos/areas', area.slug]"
                  class="bg-superficie rounded-2xl border shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 no-underline group cursor-pointer block"
                  [ngClass]="cfg(area.slug).border">
                  <!-- Icon -->
                  <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors"
                    [ngClass]="cfg(area.slug).bg">
                    <mat-icon [ngClass]="cfg(area.slug).color" style="font-size:28px;height:28px;width:28px">
                      {{ cfg(area.slug).icon }}
                    </mat-icon>
                  </div>
                  <!-- Name -->
                  <h3 class="font-bold text-texto text-base mb-1 group-hover:text-marca transition-colors leading-tight">
                    {{ area.nome }}
                  </h3>
                  <!-- Category count -->
                  <p class="text-texto-suave text-sm mb-3">
                    {{ area.categorias.length }} categoria{{ area.categorias.length !== 1 ? 's' : '' }}
                  </p>
                  <!-- Category pills preview -->
                  <div class="flex flex-wrap gap-1.5">
                    @for (cat of area.categorias.slice(0, 3); track cat) {
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-superficie-2 text-texto-suave">
                        {{ cat.nome }}
                      </span>
                    }
                    @if (area.categorias.length > 3) {
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-superficie-2 text-texto-suave">
                        +{{ area.categorias.length - 3 }}
                      </span>
                    }
                  </div>
                </a>
              }
            </div>
          }
        </div>
      </section>
    
    </div>
    `
})
export class ListaAreasComponent implements OnInit {
  private cursoService = inject(CursoService);
  areas = signal<Area[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.cursoService.listarAreas().subscribe({
      next: data => { this.areas.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  cfg(slug: string) {
    return AREA_CONFIG[slug] ?? { icon: 'category', color: 'text-texto', bg: 'bg-superficie-2', border: 'border-borda' };
  }
}
