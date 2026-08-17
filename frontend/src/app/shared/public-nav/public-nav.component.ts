import { Component, computed, ElementRef, HostListener, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { CursoService, Area, TipoCurso, Regiao, Unidade } from '../../core/services/curso.service';
import { LogoMarcaComponent } from '../logo-marca/logo-marca.component';

@Component({
    selector: 'app-public-nav',
    imports: [RouterModule, MatIconModule, LogoMarcaComponent],
    template: `
    <!-- ══════════════════════════════════════════════════════ Header -->
    <header class="fixed top-0 left-0 right-0 bg-superficie z-50 shadow-xs">
    
      <div class="h-16 max-w-screen-xl mx-auto px-4 lg:px-8 flex items-center gap-6">
    
        <!-- Logo -->
        <a routerLink="/home" class="flex items-center no-underline shrink-0">
          <app-logo-marca sobre="claro" tamanho="sm"></app-logo-marca>
        </a>
    
        <!-- Desktop nav — visible apenas em ≥ lg (1024px) -->
        <nav class="hidden lg:flex items-center gap-1 flex-1 min-w-0">
    
          <a routerLink="/home" routerLinkActive="!text-marca !font-semibold"
            [routerLinkActiveOptions]="{exact: true}"
             class="shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium text-texto
                    hover:text-marca hover:bg-marca-suave transition-colors no-underline">
            Home
          </a>
    
          <!-- Cursos trigger -->
          <button (click)="toggleDropdown('cursos')"
            class="shrink-0 whitespace-nowrap flex items-center gap-0.5 px-3 py-2 rounded-lg text-sm
                   font-medium transition-colors cursor-pointer border-0 bg-transparent"
            [class]="activeDropdown() === 'cursos'
              ? 'text-marca bg-marca-suave font-semibold'
              : 'text-texto hover:text-marca hover:bg-marca-suave'">
            Cursos
            <mat-icon class="transition-transform duration-200 text-base"
              [style.transform]="activeDropdown() === 'cursos' ? 'rotate(180deg)' : 'rotate(0deg)'"
            style="font-size:18px;height:18px;width:18px">expand_more</mat-icon>
          </button>
    
          <!-- Unidades trigger -->
          <button (click)="toggleDropdown('unidades')"
            class="shrink-0 whitespace-nowrap flex items-center gap-0.5 px-3 py-2 rounded-lg text-sm
                   font-medium transition-colors cursor-pointer border-0 bg-transparent"
            [class]="activeDropdown() === 'unidades'
              ? 'text-marca bg-marca-suave font-semibold'
              : 'text-texto hover:text-marca hover:bg-marca-suave'">
            Unidades
            <mat-icon class="transition-transform duration-200 text-base"
              [style.transform]="activeDropdown() === 'unidades' ? 'rotate(180deg)' : 'rotate(0deg)'"
            style="font-size:18px;height:18px;width:18px">expand_more</mat-icon>
          </button>
    
          <a routerLink="/sobre"
             class="shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium text-texto
                    hover:text-marca hover:bg-marca-suave transition-colors no-underline">
            Bolsas de Estudo
          </a>
          <a routerLink="/sobre"
             class="shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium text-texto
                    hover:text-marca hover:bg-marca-suave transition-colors no-underline">
            Eventos
          </a>
        </nav>
    
        <!-- CTA + hamburger -->
        <div class="flex items-center gap-3 shrink-0">
          @if (!auth.isLoggedIn()) {
            <a routerLink="/login"
               class="shrink-0 whitespace-nowrap text-texto hover:text-marca text-sm
                      font-medium transition-colors no-underline hidden sm:block">
              Entrar
            </a>
            <a routerLink="/login"
               class="shrink-0 bg-destaque hover:bg-destaque-escuro text-white font-semibold text-sm
                      px-5 py-2 rounded-xl transition-colors no-underline whitespace-nowrap">
              Matricule-se
            </a>
          }
          @if (auth.isLoggedIn()) {
            <a routerLink="/dashboard"
             class="shrink-0 bg-marca text-white font-semibold text-sm px-5 py-2 rounded-xl
                    hover:bg-marca-escura transition-colors no-underline flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon style="font-size:18px;height:18px;width:18px">dashboard</mat-icon>
              Meu Painel
            </a>
          }
    
          <!-- Hamburguer — abaixo de lg -->
          <button (click)="menuOpen.set(!menuOpen())"
            class="lg:hidden p-2 rounded-lg hover:bg-superficie-2 transition-colors border-0
                   bg-transparent cursor-pointer text-texto shrink-0">
            <mat-icon>{{ menuOpen() ? 'close' : 'menu' }}</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- ════════════════════════════════════════════ Mega-dropdown: Cursos -->
      @if (activeDropdown() === 'cursos') {
        <div
          class="absolute top-full left-0 right-0 bg-superficie shadow-lg border-t border-borda z-50">
          <div class="max-w-5xl mx-auto px-8 py-6 grid grid-cols-2 gap-16">
            <!-- Áreas -->
            <div>
              <p class="text-texto font-bold text-xs uppercase tracking-widest mb-4">Áreas</p>
              <ul class="space-y-2">
                @for (area of areas(); track area) {
                  <li>
                    <a [routerLink]="['/cursos/areas', area.slug]"
                      (click)="activeDropdown.set(null)"
                      class="text-marca text-sm hover:underline no-underline block">
                      {{ area.nome }}
                    </a>
                  </li>
                }
              </ul>
              <a routerLink="/cursos/areas" (click)="activeDropdown.set(null)"
                class="text-destaque text-xs font-semibold hover:underline no-underline mt-4 block">
                Ver todas as áreas →
              </a>
            </div>
            <!-- Tipos -->
            <div>
              <p class="text-texto font-bold text-xs uppercase tracking-widest mb-4">Tipos de Curso</p>
              <ul class="space-y-2">
                @for (tipo of tipos(); track tipo) {
                  <li>
                    <a [routerLink]="['/cursos/tipos', tipo.slug]"
                      (click)="activeDropdown.set(null)"
                      class="text-marca text-sm hover:underline no-underline block">
                      {{ tipo.nome }}
                    </a>
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>
      }
    
      <!-- ════════════════════════════════════════════ Mega-dropdown: Unidades -->
      @if (activeDropdown() === 'unidades') {
        <div
          class="absolute top-full left-0 right-0 bg-superficie shadow-lg border-t border-borda z-50">
          <div class="max-w-screen-xl mx-auto px-8 py-6">
            <!-- Estado: carregando -->
            @if (loadingUnidades()) {
              <div class="py-6 text-center text-texto-suave text-sm">
                Carregando unidades...
              </div>
            }
            <!-- Estado: uma coluna por região, na ordem em que a API as devolve.
                 Antes eram quatro blocos escritos à mão ("Capital", "Grande SP e
                 Litoral", "Interior", "Centros Universitários") — a estrutura
                 regional de um cliente específico embutida no template. Um
                 cliente com outras regiões via um menu vazio. -->
            @if (!loadingUnidades() && grupos().length > 0) {
              <div class="grid gap-x-8 gap-y-6"
                [style.grid-template-columns]="'repeat(auto-fit, minmax(180px, 1fr))'">
                @for (grupo of grupos(); track grupo.regiao) {
                  <div>
                    <p class="text-texto font-bold text-xs uppercase tracking-widest mb-3">{{ grupo.regiao }}</p>
                    <ul class="space-y-1.5 overflow-y-auto pr-1" style="max-height:260px">
                      @for (u of grupo.unidades; track u.id) {
                        <li>
                          <a [routerLink]="['/unidades', u.slug]"
                            (click)="activeDropdown.set(null)"
                            class="text-marca text-sm hover:underline no-underline block truncate">
                            {{ u.nome }}
                          </a>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }
            <!-- Fallback: resumo por regiões (enquanto unidades carregam ou API indisponível) -->
            @if (!loadingUnidades() && grupos().length === 0) {
              <p class="text-texto font-bold text-xs uppercase tracking-widest mb-4">Regiões</p>
              <ul class="grid grid-cols-2 gap-x-16 gap-y-2.5">
                @for (regiao of regioes(); track regiao) {
                  <li>
                    <a [routerLink]="['/unidades']" [queryParams]="{ regiaoId: regiao.id }"
                      (click)="activeDropdown.set(null)"
                      class="text-marca text-sm hover:underline no-underline flex items-center justify-between group">
                      <span>{{ regiao.nome }}</span>
                      <span class="text-xs text-texto-suave ml-2 group-hover:text-marca transition-colors">
                        {{ regiao.totalUnidades }}
                      </span>
                    </a>
                  </li>
                }
              </ul>
            }
            <!-- Link footer -->
            <a routerLink="/unidades" (click)="activeDropdown.set(null)"
              class="text-destaque text-xs font-semibold hover:underline no-underline mt-5 block">
              Ver todas as unidades →
            </a>
          </div>
        </div>
      }
    
    </header>
    
    <!-- ═════════════════════════════════════════════════ Mobile: overlay -->
    @if (menuOpen()) {
      <div (click)="menuOpen.set(false)"
      class="fixed inset-0 bg-black/30 z-30 lg:hidden"></div>
    }
    
    <!-- ═════════════════════════════════════════════════ Mobile: painel -->
    @if (menuOpen()) {
      <div
        class="fixed top-16 left-0 right-0 bg-superficie z-40 lg:hidden shadow-lg border-t border-borda overflow-y-auto"
        style="max-height: calc(100vh - 4rem)">
        <nav class="flex flex-col py-2">
          <a routerLink="/home" (click)="closeAll()"
           class="text-texto hover:text-marca hover:bg-marca-suave px-6 py-3 text-sm
                  font-medium transition-colors no-underline">
            Home
          </a>
          <!-- Accordion: Cursos -->
          <button (click)="toggleMobileAccordion('cursos')"
          class="flex items-center justify-between px-6 py-3 text-sm font-medium w-full
                 border-0 bg-transparent cursor-pointer text-texto hover:text-marca hover:bg-marca-suave">
            Cursos
            <mat-icon class="transition-transform duration-200"
              [style.transform]="mobileAccordion() === 'cursos' ? 'rotate(180deg)' : 'rotate(0)'"
            style="font-size:18px;height:18px;width:18px">expand_more</mat-icon>
          </button>
          @if (mobileAccordion() === 'cursos') {
            <div class="bg-fundo border-y border-borda">
              <div class="px-6 py-3">
                <p class="text-texto font-bold text-xs uppercase tracking-widest mb-3">Áreas</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                  @for (area of areas(); track area) {
                    <a [routerLink]="['/cursos/areas', area.slug]"
                      (click)="closeAll()"
                      class="text-marca text-sm hover:underline no-underline">
                      {{ area.nome }}
                    </a>
                  }
                </div>
              </div>
              <div class="border-t border-borda px-6 py-3">
                <p class="text-texto font-bold text-xs uppercase tracking-widest mb-3">Tipos</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                  @for (tipo of tipos(); track tipo) {
                    <a [routerLink]="['/cursos/tipos', tipo.slug]"
                      (click)="closeAll()"
                      class="text-marca text-sm hover:underline no-underline">
                      {{ tipo.nome }}
                    </a>
                  }
                </div>
              </div>
            </div>
          }
          <!-- Accordion: Unidades -->
          <button (click)="toggleMobileAccordion('unidades')"
          class="flex items-center justify-between px-6 py-3 text-sm font-medium w-full
                 border-0 bg-transparent cursor-pointer text-texto hover:text-marca hover:bg-marca-suave">
            Unidades
            <mat-icon class="transition-transform duration-200"
              [style.transform]="mobileAccordion() === 'unidades' ? 'rotate(180deg)' : 'rotate(0)'"
            style="font-size:18px;height:18px;width:18px">expand_more</mat-icon>
          </button>
          @if (mobileAccordion() === 'unidades') {
            <div class="bg-fundo border-y border-borda px-6 py-3">
              <!-- Unidades carregadas: agrupadas por região -->
              @if (gruposMobile().length > 0) {
                @for (grupo of gruposMobile(); track grupo) {
                  <p class="text-texto font-bold text-xs uppercase tracking-widest mb-2 mt-3">
                    {{ grupo.regiao }}
                  </p>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-1">
                    @for (u of grupo.unidades; track u) {
                      <a
                        [routerLink]="['/unidades', u.slug]"
                        (click)="closeAll()"
                        class="text-marca text-sm hover:underline no-underline truncate">
                        {{ u.nome }}
                      </a>
                    }
                  </div>
                }
              }
              <!-- Fallback: resumo de regiões (enquanto unidades carregam) -->
              @if (gruposMobile().length === 0) {
                @for (regiao of regioes(); track regiao) {
                  <a
                    [routerLink]="['/unidades']" [queryParams]="{ regiaoId: regiao.id }"
                    (click)="closeAll()"
               class="text-marca text-sm hover:underline no-underline flex items-center
                      justify-between py-1.5">
                    <span>{{ regiao.nome }}</span>
                    <span class="text-xs text-texto-suave">{{ regiao.totalUnidades }}</span>
                  </a>
                }
              }
            </div>
          }
          <a routerLink="/sobre" (click)="closeAll()"
           class="text-texto hover:text-marca hover:bg-marca-suave px-6 py-3 text-sm
                  font-medium transition-colors no-underline">
            Bolsas de Estudo
          </a>
          <a routerLink="/sobre" (click)="closeAll()"
           class="text-texto hover:text-marca hover:bg-marca-suave px-6 py-3 text-sm
                  font-medium transition-colors no-underline">
            Eventos
          </a>
          <div class="border-t border-borda mt-2 pt-2 px-4 pb-4 flex flex-col gap-2">
            @if (!auth.isLoggedIn()) {
              <a routerLink="/login" (click)="closeAll()"
             class="text-center text-texto hover:text-marca py-2.5 text-sm font-medium
                    transition-colors no-underline block border border-borda rounded-xl">
                Entrar
              </a>
            }
            @if (!auth.isLoggedIn()) {
              <a routerLink="/login" (click)="closeAll()"
             class="text-center bg-destaque text-white font-semibold text-sm py-3 rounded-xl
                    transition-colors no-underline block">
                Matricule-se
              </a>
            }
            @if (auth.isLoggedIn()) {
              <a routerLink="/dashboard" (click)="closeAll()"
             class="text-center bg-marca text-white font-semibold text-sm py-3 rounded-xl
                    transition-colors no-underline block">
                Meu Painel
              </a>
            }
          </div>
        </nav>
      </div>
    }
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`:host { display: block; }`]
})
export class PublicNavComponent implements OnInit {
  private elRef = inject(ElementRef);
  private router = inject(Router);
  auth = inject(AuthService);
  private cursoService = inject(CursoService);

  menuOpen = signal(false);
  activeDropdown = signal<'cursos' | 'unidades' | null>(null);
  mobileAccordion = signal<'cursos' | 'unidades' | null>(null);

  areas = signal<Area[]>([]);
  tipos = signal<TipoCurso[]>([]);
  regioes = signal<Regiao[]>([]);
  todasUnidades = signal<Unidade[]>([]);
  loadingUnidades = signal(true);

  /**
   * Unidades agrupadas por região, na ordem em que `/api/regioes` as devolve —
   * a mesma que o administrador vê no painel. Regiões que a listagem não
   * conhecer entram depois, para nenhuma unidade sumir do menu.
   *
   * Substitui a antiga lista fixa de quatro regiões nomeadas no código, que só
   * funcionava para a base de dados de um cliente.
   */
  grupos = computed<{ regiao: string; unidades: Unidade[] }[]>(() => {
    const todas = this.todasUnidades();
    if (!todas.length) return [];

    const porRegiao = new Map<string, Unidade[]>();
    for (const u of todas) {
      const lista = porRegiao.get(u.regiaoNome);
      if (lista) lista.push(u);
      else porRegiao.set(u.regiaoNome, [u]);
    }

    const ordenadas = this.regioes().map(r => r.nome).filter(nome => porRegiao.has(nome));
    const restantes = [...porRegiao.keys()].filter(nome => !ordenadas.includes(nome));

    return [...ordenadas, ...restantes].map(regiao => ({ regiao, unidades: porRegiao.get(regiao)! }));
  });

  /** O painel mobile mostra os mesmos grupos, só que empilhados. */
  gruposMobile = this.grupos;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(() => {
      this.activeDropdown.set(null);
      this.menuOpen.set(false);
    });
  }

  ngOnInit() {
    this.cursoService.listarAreas().subscribe(a => this.areas.set(a));
    this.cursoService.listarTipos().subscribe(t => this.tipos.set(t));
    this.cursoService.listarRegioes().subscribe(r => this.regioes.set(r));
    this.cursoService.listarTodasUnidades().subscribe({
      next: u => { this.todasUnidades.set(u); this.loadingUnidades.set(false); },
      error: () => this.loadingUnidades.set(false)
    });
  }

  toggleDropdown(menu: 'cursos' | 'unidades') {
    this.activeDropdown.set(this.activeDropdown() === menu ? null : menu);
  }

  toggleMobileAccordion(menu: 'cursos' | 'unidades') {
    this.mobileAccordion.set(this.mobileAccordion() === menu ? null : menu);
  }

  closeAll() {
    this.activeDropdown.set(null);
    this.menuOpen.set(false);
    this.mobileAccordion.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      this.activeDropdown.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.activeDropdown.set(null);
    this.menuOpen.set(false);
    this.mobileAccordion.set(null);
  }
}
