import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  afterNextRender,
  Injector,
  ElementRef,
  signal,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  WritableSignal,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import {
  CursoService,
  Curso,
  MatriculaDetalhe,
  Regiao,
  Professor,
  UsuarioResponse,
} from '../../../core/services/curso.service';
import { AuthService } from '../../../core/services/auth.service';
import { TemaService, COR_FALLBACK, type Paleta, type TokenCor } from '../../../core/services/tema.service';

Chart.register(...registerables);

interface MatriculaComCurso extends MatriculaDetalhe {
  cursoId: number;
  cursoTitulo: string;
}

@Component({
    selector: 'app-admin-dashboard',
    imports: [CommonModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private cursoService = inject(CursoService);
  auth = inject(AuthService);
  private tema = inject(TemaService);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('barChartCanvas') barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('horizontalBarCanvas') horizontalBarCanvas!: ElementRef<HTMLCanvasElement>;

  isLoading = signal(true);
  isRefreshing = signal(false);
  hasError = signal(false);

  usuarios = signal<UsuarioResponse[]>([]);
  cursos = signal<Curso[]>([]);
  matriculas = signal<MatriculaComCurso[]>([]);
  regioes = signal<Regiao[]>([]);
  professores = signal<Professor[]>([]);

  displayAlunos = signal(0);
  displayCursos = signal(0);
  displayProfessores = signal(0);
  displayMatriculas = signal(0);

  readonly skeletonItems = [0, 1, 2, 3];
  readonly skeletonItems3 = [0, 1, 2];
  readonly skeletonTableRows = [0, 1, 2, 3, 4];

  totalAlunos = computed(() => this.usuarios().filter(u => u.role === 'ALUNO').length);
  cursosAtivos = computed(() => this.cursos().length);
  totalProfessores = computed(() => this.professores().length);
  totalMatriculas = computed(() => this.matriculas().length);

  ultimasMatriculas = computed(() =>
    [...this.matriculas()]
      .sort((a, b) => new Date(b.matriculadoEm).getTime() - new Date(a.matriculadoEm).getTime())
      .slice(0, 10)
  );

  top5Cursos = computed(() => {
    const countMap = new Map<number, { titulo: string; count: number }>();
    this.matriculas().forEach(m => {
      const e = countMap.get(m.cursoId);
      if (e) { e.count++; } else { countMap.set(m.cursoId, { titulo: m.cursoTitulo, count: 1 }); }
    });
    const sorted = Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    const max = sorted[0]?.count || 1;
    return sorted.map(c => ({ ...c, percentual: Math.round((c.count / max) * 100) }));
  });

  private readonly injector = inject(Injector);

  private barChart: Chart | null = null;
  private doughnutChart: Chart | null = null;
  private horizontalBarChart: Chart | null = null;
  private chartsInitialized = false;

  constructor() {
    // Antes: effect() -> setTimeout(50) -> initCharts(), que lia
    // @ViewChild(...).nativeElement. Isso apostava que o zone.js já teria feito
    // o render dentro dos 50ms. Sem zone.js essa aposta não se sustenta.
    // afterNextRender só dispara depois que o DOM foi de fato pintado, então os
    // canvases existem — e não há mais número mágico.
    effect(() => {
      if (!this.isLoading() && !this.chartsInitialized) {
        this.chartsInitialized = true;
        afterNextRender(() => {
          this.initCharts();
          this.runCountUp();
          this.runGsapAnimations();
        }, { injector: this.injector });
      }
    });

    // Os gráficos são canvas: o Chart.js resolve as cores na criação, então não
    // acompanham a troca de tema sozinhos e ficariam ilegíveis no escuro.
    //
    // A recriação é direta, sem afterNextRender: os canvases já existem neste
    // ponto, e a troca de tema não agenda um novo render do componente — o
    // callback simplesmente não dispararia.
    effect(() => {
      const tema = this.tema.temaAtual(); // dependência: cor ou modo
      if (!this.chartsInitialized || !this.barChart) return;
      this.paleta = tema.cores;
      this.destroyCharts();
      this.initCharts();
    });
  }

  /** Paleta em uso pelos gráficos; atualizada pelo efeito de re-tematização. */
  private paleta: Paleta | null = null;

  /**
   * Cor de um token, lida do signal do tema — e não de `getComputedStyle`.
   *
   * Ler do DOM criaria dependência da ordem em que os efeitos rodam: se este
   * efeito corresse antes do TemaService escrever as variáveis, os gráficos
   * seriam pintados com as cores do modo anterior.
   */
  private corTema(token: TokenCor): string {
    return (this.paleta ?? this.tema.temaAtual().cores)[token] || COR_FALLBACK;
  }

  /** Converte um token para rgba com a opacidade dada. */
  private corTemaAlpha(token: TokenCor, alpha: number): string {
    const hex = this.corTema(token).replace('#', '');
    const n = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Opções compartilhadas de tooltip: fundo "inverso" legível nos dois modos. */
  private tooltipTema() {
    return {
      backgroundColor: this.corTema('texto'),
      titleColor: this.corTema('superficie'),
      bodyColor: this.corTemaAlpha('superficie', 0.85),
      padding: 12,
    };
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private destroyCharts(): void {
    this.barChart?.destroy();
    this.doughnutChart?.destroy();
    this.horizontalBarChart?.destroy();
    this.barChart = null;
    this.doughnutChart = null;
    this.horizontalBarChart = null;
  }

  loadData(isRefresh = false): void {
    if (!isRefresh) {
      this.isLoading.set(true);
      this.chartsInitialized = false;
    }
    this.hasError.set(false);

    forkJoin({
      cursosData: this.cursoService.listarTodosCursos().pipe(
        switchMap(page => {
          const cursos = page.content;
          if (cursos.length === 0) {
            return of({ cursos, matriculasMap: {} as Record<number, MatriculaDetalhe[]> });
          }
          const reqs: Record<string, Observable<MatriculaDetalhe[]>> = {};
          cursos.forEach(c => {
            reqs[String(c.id)] = this.cursoService.listarMatriculasCurso(c.id).pipe(
              catchError(() => of([] as MatriculaDetalhe[]))
            );
          });
          return forkJoin(reqs).pipe(
            map(mm => {
              const typed: Record<number, MatriculaDetalhe[]> = {};
              Object.entries(mm).forEach(([k, v]) => { typed[Number(k)] = v; });
              return { cursos, matriculasMap: typed };
            })
          );
        })
      ),
      usuarios: this.cursoService.listarUsuarios(),
      regioes: this.cursoService.listarRegioes(),
      professores: this.cursoService.listarProfessores(),
    }).subscribe({
      next: ({ cursosData, usuarios, regioes, professores }) => {
        const allMatriculas: MatriculaComCurso[] = [];
        cursosData.cursos.forEach(c => {
          (cursosData.matriculasMap[c.id] || []).forEach(m =>
            allMatriculas.push({ ...m, cursoId: c.id, cursoTitulo: c.titulo })
          );
        });
        this.cursos.set(cursosData.cursos);
        this.matriculas.set(allMatriculas);
        this.usuarios.set(usuarios);
        this.regioes.set(regioes);
        this.professores.set(professores);

        if (isRefresh) {
          this.isRefreshing.set(false);
          this.runCountUp(true);
          afterNextRender(() => this.refreshCharts(), { injector: this.injector });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.hasError.set(true);
      },
    });
  }

  refresh(): void {
    if (this.isRefreshing() || this.isLoading()) return;
    this.isRefreshing.set(true);
    this.loadData(true);
  }

  private initCharts(): void {
    this.initBarChart();
    this.initDoughnutChart();
    this.initHorizontalBarChart();
  }

  private refreshCharts(): void {
    if (this.barChart) {
      const months = this.getMatriculasPorMes();
      this.barChart.data.labels = months.map(m => m.label);
      this.barChart.data.datasets[0].data = months.map(m => m.count);
      this.barChart.update('active');
    }
    if (this.doughnutChart) {
      const niveis = this.getCursosPorNivel();
      this.doughnutChart.data.datasets[0].data = niveis.map(n => n.count);
      this.doughnutChart.update('active');
    }
    if (this.horizontalBarChart) {
      this.horizontalBarChart.data.labels = this.regioes().map(r => r.nome);
      this.horizontalBarChart.data.datasets[0].data = this.regioes().map(r => r.totalUnidades);
      this.horizontalBarChart.update('active');
    }
  }

  private initBarChart(): void {
    if (!this.barChartCanvas?.nativeElement) return;
    const ctx = this.barChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    const months = this.getMatriculasPorMes();
    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          label: 'Matrículas',
          data: months.map(m => m.count),
          backgroundColor: this.corTemaAlpha('marca', 0.85),
          borderColor: this.corTema('marca'),
          hoverBackgroundColor: this.corTema('marca'),
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...this.tooltipTema(),
            displayColors: false,
            callbacks: { label: (c) => `${c.parsed.y} matrículas` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: this.corTema('textoSuave'), font: { size: 12 } },
            grid: { color: this.corTemaAlpha('textoSuave', 0.12) },
          },
          x: {
            ticks: { color: this.corTema('textoSuave'), font: { size: 12 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  private initDoughnutChart(): void {
    if (!this.doughnutCanvas?.nativeElement) return;
    const ctx = this.doughnutCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    const niveis = this.getCursosPorNivel();
    this.doughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: niveis.map(n => n.label),
        datasets: [{
          data: niveis.map(n => n.count),
          backgroundColor: [this.corTema('sucesso'), this.corTema('aviso'), this.corTema('erro')],
          borderWidth: 3,
          borderColor: this.corTema('superficie'),
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateRotate: true, duration: 800 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: this.corTema('textoSuave'), padding: 16, usePointStyle: true, font: { size: 12 } },
          },
          tooltip: this.tooltipTema(),
        },
      },
    });
  }

  private initHorizontalBarChart(): void {
    if (!this.horizontalBarCanvas?.nativeElement) return;
    const ctx = this.horizontalBarCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    const regioes = this.regioes();
    this.horizontalBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: regioes.map(r => r.nome),
        datasets: [{
          label: 'Unidades',
          data: regioes.map(r => r.totalUnidades),
          backgroundColor: regioes.map((_, i) =>
            i % 2 === 0 ? this.corTemaAlpha('marca', 0.85) : this.corTemaAlpha('textoSuave', 0.65)
          ),
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: this.tooltipTema(),
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 5, color: this.corTema('textoSuave'), font: { size: 11 } },
            grid: { color: this.corTemaAlpha('textoSuave', 0.12) },
          },
          y: {
            ticks: { color: this.corTema('textoSuave'), font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  getMatriculasPorMes(): { label: string; count: number }[] {
    const now = new Date();
    const result: { label: string; count: number; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        count: 0,
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    this.matriculas().forEach(m => {
      const d = new Date(m.matriculadoEm);
      const idx = result.findIndex(r => r.year === d.getFullYear() && r.month === d.getMonth());
      if (idx >= 0) result[idx].count++;
    });
    return result.map(({ label, count }) => ({ label, count }));
  }

  getCursosPorNivel(): { label: string; count: number }[] {
    return [
      { label: 'Básico', count: this.cursos().filter(c => c.nivel === 'BASICO').length },
      { label: 'Intermediário', count: this.cursos().filter(c => c.nivel === 'INTERMEDIARIO').length },
      { label: 'Avançado', count: this.cursos().filter(c => c.nivel === 'AVANCADO').length },
    ];
  }

  private runCountUp(isRefresh = false): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.displayAlunos.set(this.totalAlunos());
      this.displayCursos.set(this.cursosAtivos());
      this.displayProfessores.set(this.totalProfessores());
      this.displayMatriculas.set(this.totalMatriculas());
      return;
    }
    const from = isRefresh
      ? { a: this.displayAlunos(), c: this.displayCursos(), p: this.displayProfessores(), m: this.displayMatriculas() }
      : { a: 0, c: 0, p: 0, m: 0 };
    this.animateCount(this.displayAlunos, from.a, this.totalAlunos(), 900);
    this.animateCount(this.displayCursos, from.c, this.cursosAtivos(), 800);
    this.animateCount(this.displayProfessores, from.p, this.totalProfessores(), 700);
    this.animateCount(this.displayMatriculas, from.m, this.totalMatriculas(), 1000);
  }

  private animateCount(target: WritableSignal<number>, start: number, end: number, duration: number): void {
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      target.set(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private async runGsapAnimations(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const { gsap } = await import('gsap');
    gsap.from('.kpi-card', { opacity: 0, y: 24, stagger: 0.08, duration: 0.5, ease: 'power2.out', clearProps: 'all' });
    gsap.from('.chart-section', { opacity: 0, y: 16, stagger: 0.1, duration: 0.45, ease: 'power2.out', delay: 0.25, clearProps: 'all' });
    // As barras do "top 5" só existem depois que top5Cursos() renderiza. Antes
    // isso era um setTimeout(300) torcendo para o DOM estar pronto; agora é o
    // próprio ciclo de render que avisa.
    afterNextRender(() => {
      document.querySelectorAll<HTMLElement>('.top-curso-bar').forEach((bar, i) => {
        gsap.to(bar, { width: bar.dataset['width'] || '0%', duration: 0.8, delay: i * 0.12, ease: 'power2.out' });
      });
    }, { injector: this.injector });
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'EM_ANDAMENTO') return 'lms-badge lms-badge-marca';
    if (status === 'CONCLUIDO') return 'lms-badge lms-badge-sucesso';
    if (status === 'CANCELADO') return 'bg-rose-100 text-rose-700';
    return 'bg-superficie-2 text-texto-suave';
  }

  getStatusText(status: string): string {
    if (status === 'EM_ANDAMENTO') return 'Em Andamento';
    if (status === 'CONCLUIDO') return 'Concluído';
    if (status === 'CANCELADO') return 'Cancelado';
    return status;
  }

  getAvatarBg(nome: string): string {
    const colors = ['bg-marca', 'bg-sucesso', 'bg-amber-500', 'bg-rose-500', 'bg-marca', 'bg-sky-500'];
    return colors[(nome?.charCodeAt(0) || 0) % colors.length];
  }

  getInitial(nome: string): string {
    return nome ? nome.charAt(0).toUpperCase() : '?';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  trackById(_: number, item: { id: number }): number { return item.id; }
  trackByIdx(index: number): number { return index; }
}
