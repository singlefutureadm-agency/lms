import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, AbstractControl, Validators, FormsModule, FormArray } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CursoService, Curso, CursoDetalhe, MatriculaDetalhe, Unidade, Area, TipoCurso, AulaInfo, TipoVideoModulo } from '../../../core/services/curso.service';
import { UploadService } from '../../../core/services/upload.service';
import { ImageUploadComponent } from '../../../shared/image-upload/image-upload.component';
import { VideoUploadComponent } from '../../../shared/video-upload/video-upload.component';
import { VideoEmbedComponent } from '../../../shared/video-embed/video-embed.component';
import { detectarTipoVideo } from '../../../shared/video-embed/video-embed.util';
import { mensagemDeErro } from '../../../core/interceptors/error.interceptor';

const FILTRO_DEBOUNCE_MS = 300;

@Component({
    selector: 'app-admin-cursos',
    imports: [FormsModule, ReactiveFormsModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule, MatTabsModule, MatPaginatorModule, ImageUploadComponent, VideoUploadComponent, VideoEmbedComponent],
    templateUrl: './admin-cursos.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./admin-cursos.component.scss']
})
export class AdminCursosComponent implements OnInit, OnDestroy {
  private svc = inject(CursoService);
  private uploadSvc = inject(UploadService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  cursos = signal<Curso[]>([]);
  unidades = signal<Unidade[]>([]);
  areas = signal<Area[]>([]);
  tiposDisponiveis = signal<TipoCurso[]>([]);
  categoriasSelecionadas = signal<Set<number>>(new Set());
  tiposSelecionados = signal<Set<number>>(new Set());
  loading = signal(true);
  salvando = signal(false);
  editando = signal<Curso | null>(null);
  mostrarForm = signal(false);
  cursoExpandido = signal<number | null>(null);
  imagemSelecionada = signal<File | null>(null);
  uploadandoCapa = signal(false);
  matriculasCurso = signal<Record<number, MatriculaDetalhe[]>>({});
  loadingAlunos = signal<number | null>(null);
  notasEditando = signal<Record<number, string>>({});
  salvandoNota = signal<number | null>(null);
  niveis = ['BASICO', 'INTERMEDIARIO', 'AVANCADO'];
  colunas = ['titulo', 'nivel', 'criado', 'acoes'];

  // Paginação da listagem — o backend já pagina via Pageable (page/size); antes
  // o componente carregava as 200 primeiras linhas de uma vez com listarTodosCursos().
  pageIndex = signal(0);
  pageSize = signal(10);
  totalCursos = signal(0);
  filtro = signal('');
  private filtroDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  // Aulas: geridas por CRUD próprio (POST/PUT/DELETE /api/aulas), à parte do
  // merge incremental de módulos — só existem para módulos já persistidos.
  aulasPorModulo = signal<Record<number, AulaInfo[]>>({});
  moduloAulasExpandido = signal<number | null>(null);
  moduloAulaAtivo = signal<number | null>(null);
  editandoAula = signal<AulaInfo | null>(null);
  salvandoAula = signal(false);

  // Vídeo de módulo: upload imediato pra módulo já existente (id real), ou
  // pendente até o curso ser salvo pra módulo novo (id ainda null) — ver
  // onVideoSelected/salvar. As chaves dos dois Maps são o índice no FormArray,
  // não o id do módulo (que pra módulo novo ainda não existe).
  videosPendentes = signal<Map<number, File>>(new Map());
  progressoPorModulo = signal<Map<number, number>>(new Map());
  enviandoVideos = signal(false);

  // Link de YouTube/Vimeo é a alternativa ao upload — as duas opções coexistem,
  // mas só uma fica preenchida por módulo. tipoVideoSelecionado é estado só de
  // UI (qual dos dois widgets mostrar); o valor "de verdade" é o par
  // urlVideo/tipoVideo dentro do próprio FormGroup do módulo, que é o que vai
  // no payload do curso — link não passa por upload, é síncrono com o submit.
  tipoVideoSelecionado = signal<Map<number, TipoVideoModulo>>(new Map());
  erroLinkVideo = signal<Map<number, string>>(new Map());

  // Só trava o botão de salvar por upload/remoção de vídeo em andamento, ou
  // por um link de YouTube/Vimeo com formato inválido ainda não corrigido —
  // selecionar/remover um vídeo por si só não impede salvar.
  podeSalvar = computed(() =>
    !this.enviandoVideos() && !this.salvando() && !this.form.invalid && this.erroLinkVideo().size === 0);

  // Média dos uploads de vídeo em andamento — mostrada no botão salvar
  // enquanto enviandoVideos() é true. null quando não há progresso reportado
  // ainda (ex. remoção de vídeo, ou upload que não emitiu progresso).
  progressoVideos = computed(() => {
    const valores = Array.from(this.progressoPorModulo().values());
    if (valores.length === 0) return null;
    return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
  });

  aulaForm = this.fb.group({
    titulo: ['', [Validators.required]],
    urlVideo: [''],
    duracaoMin: [0, [Validators.required, Validators.min(0)]],
    ordem: [1, [Validators.required]]
  });

  // Formulário estendido com a lista de módulos (FormArray)
  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descricao: [''],
    nivel: ['BASICO', Validators.required],
    unidadeId: [null as number | null],
    areaId: [null as number | null, Validators.required],
    modulos: this.fb.array([])
  });

  ngOnInit() {
    this.carregarCursos(0);
    this.svc.listarTodasUnidades().subscribe({
      next: data => this.unidades.set(data),
      error: err => console.error('Erro ao carregar unidades:', err)
    });
    this.svc.listarAreas().subscribe({
      next: data => this.areas.set(data),
      error: err => console.error('Erro ao carregar áreas:', err)
    });
    this.svc.listarTipos().subscribe({
      next: data => this.tiposDisponiveis.set(data),
      error: err => console.error('Erro ao carregar tipos:', err)
    });
  }

  ngOnDestroy() {
    if (this.filtroDebounceHandle) clearTimeout(this.filtroDebounceHandle);
  }

  carregarCursos(pageIndex: number) {
    this.pageIndex.set(pageIndex);
    this.loading.set(true);
    const q = this.filtro().trim() || undefined;
    this.svc.listarCursosAdmin(pageIndex, this.pageSize(), q).subscribe({
      next: page => {
        this.cursos.set(page.content);
        this.totalCursos.set(page.page.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onPage(evento: PageEvent) {
    this.pageSize.set(evento.pageSize);
    this.carregarCursos(evento.pageIndex);
  }

  onFiltroChange(valor: string) {
    this.filtro.set(valor);
    if (this.filtroDebounceHandle) clearTimeout(this.filtroDebounceHandle);
    this.filtroDebounceHandle = setTimeout(() => this.carregarCursos(0), FILTRO_DEBOUNCE_MS);
  }

  toggleCategoria(id: number) {
    const set = new Set(this.categoriasSelecionadas());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.categoriasSelecionadas.set(set);
  }

  toggleTipo(id: number) {
    const set = new Set(this.tiposSelecionados());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.tiposSelecionados.set(set);
  }

  // Getter tipado para ler o array de módulos no template HTML
  get modulosFormArray(): FormArray {
    return this.form.get('modulos') as FormArray;
  }

  adicionarModulo() {
    const novaOrdem = this.modulosFormArray.length + 1;
    const moduloGroup = this.fb.group({
      id: [null],
      titulo: ['', [Validators.required]],
      ordem: [novaOrdem, [Validators.required]],
      urlVideo: [null as string | null],
      tipoVideo: [null as TipoVideoModulo | null]
    });
    this.modulosFormArray.push(moduloGroup);
  }

  // Método para remover um módulo e recalcular a ordenação sequencial
  removerModulo(index: number) {
    this.modulosFormArray.removeAt(index);
    this.modulosFormArray.controls.forEach((control, idx) => {
      control.get('ordem')?.setValue(idx + 1);
    });
    // videosPendentes/progressoPorModulo/tipoVideoSelecionado/erroLinkVideo são
    // indexados pela posição no FormArray — remover um módulo do meio desloca
    // os índices seguintes, então os Maps precisam ser reindexados junto
    // (senão um vídeo pendente do módulo 3 passaria a ser enviado como se
    // fosse do módulo 2).
    this.videosPendentes.update(m => this.reindexarAposRemocao(m, index));
    this.progressoPorModulo.update(m => this.reindexarAposRemocao(m, index));
    this.tipoVideoSelecionado.update(m => this.reindexarAposRemocao(m, index));
    this.erroLinkVideo.update(m => this.reindexarAposRemocao(m, index));
  }

  private reindexarAposRemocao<T>(mapa: Map<number, T>, indiceRemovido: number): Map<number, T> {
    const novo = new Map<number, T>();
    mapa.forEach((valor, idx) => {
      if (idx === indiceRemovido) return;
      novo.set(idx > indiceRemovido ? idx - 1 : idx, valor);
    });
    return novo;
  }

  // Método abrirForm reconfigurado para limpar e popular o FormArray corretamente
  abrirForm(curso?: Curso) {
    this.editando.set(curso || null);

    // 1. Limpa completamente qualquer resquício do array anterior
    while (this.modulosFormArray.length !== 0) {
      this.modulosFormArray.removeAt(0);
    }
    this.videosPendentes.set(new Map());
    this.progressoPorModulo.set(new Map());
    this.enviandoVideos.set(false);
    this.tipoVideoSelecionado.set(new Map());
    this.erroLinkVideo.set(new Map());

    // 2. Reseta os valores básicos do formulário
    this.form.patchValue({
      titulo: curso?.titulo || '',
      descricao: curso?.descricao || '',
      nivel: curso?.nivel || 'BASICO',
      unidadeId: curso?.unidadeId ?? null,
      areaId: curso?.areaId ?? null
    });

    // 2b. Popula a área/categoria e o tipo de ensino selecionados
    this.categoriasSelecionadas.set(new Set(curso?.categorias?.map(c => c.id) ?? []));
    this.tiposSelecionados.set(new Set(curso?.tipos?.map(t => t.id) ?? []));

    // 3. Se for edição, popula o FormArray dinamicamente buscando os módulos
    if (curso && curso.id) {
      this.svc.buscarCurso(curso.id).subscribe({
        next: (cursoCompleto) => {
          if (cursoCompleto && cursoCompleto.modulos) {
            const aulas: Record<number, AulaInfo[]> = {};
            const tiposIniciais = new Map<number, TipoVideoModulo>();
            cursoCompleto.modulos.forEach((mod: any, idx: number) => {
              this.modulosFormArray.push(this.fb.group({
                id: [mod.id],
                titulo: [mod.titulo || '', [Validators.required]],
                ordem: [mod.ordem, [Validators.required]],
                urlVideo: [mod.urlVideo ?? null],
                tipoVideo: [mod.tipoVideo ?? null]
              }));
              if (mod.tipoVideo) tiposIniciais.set(idx, mod.tipoVideo);
              aulas[mod.id] = mod.aulas || [];
            });
            this.tipoVideoSelecionado.set(tiposIniciais);
            this.aulasPorModulo.set(aulas);
          }
        },
        error: (err) => console.error('Erro ao buscar detalhes do curso:', err)
      });
    }

    this.mostrarForm.set(true);
    this.cursoExpandido.set(null);
  }

  // Método fecharForm garantindo a limpeza completa
  fecharForm() {
    this.mostrarForm.set(false);
    this.editando.set(null);
    while (this.modulosFormArray.length !== 0) {
      this.modulosFormArray.removeAt(0);
    }
    this.form.reset();
    this.imagemSelecionada.set(null);
    this.categoriasSelecionadas.set(new Set());
    this.tiposSelecionados.set(new Set());
    this.aulasPorModulo.set({});
    this.moduloAulasExpandido.set(null);
    this.fecharFormAula();
    this.videosPendentes.set(new Map());
    this.progressoPorModulo.set(new Map());
    this.enviandoVideos.set(false);
    this.tipoVideoSelecionado.set(new Map());
    this.erroLinkVideo.set(new Map());
  }

  onCapaSelected(file: File) { this.imagemSelecionada.set(file); }

  temVideoModulo(idx: number, moduloGroup: AbstractControl): boolean {
    return !!moduloGroup.get('urlVideo')?.value || this.videosPendentes().has(idx);
  }

  // Estado de exibição do bloco de vídeo do módulo: se já tem um tipo
  // persistido no próprio FormGroup (veio do backend, ou de um upload/link já
  // concluído), esse manda; senão cai pro estado só-de-UI de qual aba o
  // usuário escolheu (nenhuma ainda = mostra os dois botões de escolha).
  tipoVideoAtivo(idx: number, moduloGroup: AbstractControl): TipoVideoModulo | null {
    return (moduloGroup.get('tipoVideo')?.value as TipoVideoModulo | null)
      ?? this.tipoVideoSelecionado().get(idx)
      ?? null;
  }

  // As duas opções (arquivo/link) coexistem mas só uma fica preenchida por
  // módulo: escolher uma limpa qualquer resquício da outra.
  escolherModoArquivo(idx: number) {
    const moduloGroup = this.modulosFormArray.at(idx) as FormGroup;
    moduloGroup.patchValue({ urlVideo: null, tipoVideo: null });
    this.tipoVideoSelecionado.update(m => { const n = new Map(m); n.set(idx, 'ARQUIVO'); return n; });
    this.erroLinkVideo.update(m => { const n = new Map(m); n.delete(idx); return n; });
  }

  escolherModoLink(idx: number) {
    const moduloGroup = this.modulosFormArray.at(idx) as FormGroup;
    moduloGroup.patchValue({ urlVideo: null, tipoVideo: null });
    this.videosPendentes.update(m => { const n = new Map(m); n.delete(idx); return n; });
    // YOUTUBE aqui é só um placeholder pra decidir "aba de link está ativa" —
    // corrigido pro tipo real assim que o usuário digitar um link válido.
    this.tipoVideoSelecionado.update(m => { const n = new Map(m); n.set(idx, 'YOUTUBE'); return n; });
  }

  cancelarEscolhaVideo(idx: number) {
    const moduloGroup = this.modulosFormArray.at(idx) as FormGroup;
    moduloGroup.patchValue({ urlVideo: null, tipoVideo: null });
    this.tipoVideoSelecionado.update(m => { const n = new Map(m); n.delete(idx); return n; });
    this.erroLinkVideo.update(m => { const n = new Map(m); n.delete(idx); return n; });
  }

  // Digitado ao vivo: detecta YouTube/Vimeo com o mesmo padrão do backend
  // (ModuloRequestVideoValidator) — feedback imediato, sem esperar o submit
  // do curso pra descobrir que o link é inválido.
  onLinkVideoChange(idx: number, valorDigitado: string) {
    const moduloGroup = this.modulosFormArray.at(idx) as FormGroup;
    const url = (valorDigitado || '').trim();

    if (!url) {
      moduloGroup.patchValue({ urlVideo: null, tipoVideo: null });
      this.erroLinkVideo.update(m => { const n = new Map(m); n.delete(idx); return n; });
      return;
    }

    const tipo = detectarTipoVideo(url);
    if (!tipo) {
      moduloGroup.patchValue({ urlVideo: url, tipoVideo: null });
      this.erroLinkVideo.update(m => {
        const n = new Map(m);
        n.set(idx, 'Link inválido. Use uma URL do YouTube (youtube.com/watch?v=... ou youtu.be/...) ou do Vimeo (vimeo.com/...).');
        return n;
      });
      return;
    }

    moduloGroup.patchValue({ urlVideo: url, tipoVideo: tipo });
    this.tipoVideoSelecionado.update(m => { const n = new Map(m); n.set(idx, tipo); return n; });
    this.erroLinkVideo.update(m => { const n = new Map(m); n.delete(idx); return n; });
  }

  // Módulo com id real: upload dispara na hora. Módulo novo (id ainda null):
  // só fica pendente, o upload de verdade acontece depois que o curso for
  // salvo e o módulo ganhar um id (ver salvar()).
  onVideoSelected(idx: number, file: File) {
    const moduloGroup = this.modulosFormArray.at(idx) as FormGroup;
    const moduloId = moduloGroup.get('id')?.value;
    if (moduloId) {
      this.enviarVideoModulo(idx, moduloId, moduloGroup, file);
    } else {
      this.videosPendentes.update(m => { const n = new Map(m); n.set(idx, file); return n; });
    }
  }

  // Vídeo em arquivo já enviado (existente): confirma e remove na hora
  // (DELETE imediato). Arquivo ainda pendente (módulo novo): nada foi enviado
  // ao servidor ainda, só tira do Map de pendentes. Link de YouTube/Vimeo:
  // nunca passou por upload — é só limpar o FormGroup, some na hora e a
  // remoção só persiste quando o curso for salvo (igual qualquer outro campo).
  onRemoverVideo(idx: number) {
    const moduloGroup = this.modulosFormArray.at(idx) as FormGroup;
    const moduloId = moduloGroup.get('id')?.value;
    const tipoAtual = moduloGroup.get('tipoVideo')?.value as TipoVideoModulo | null;

    if (tipoAtual === 'YOUTUBE' || tipoAtual === 'VIMEO') {
      this.cancelarEscolhaVideo(idx);
      return;
    }
    if (!moduloId) {
      this.videosPendentes.update(m => { const n = new Map(m); n.delete(idx); return n; });
      this.cancelarEscolhaVideo(idx);
      return;
    }

    if (!confirm('Remover o vídeo deste módulo?')) return;
    this.enviandoVideos.set(true);
    this.uploadSvc.removerVideoModulo(moduloId).subscribe({
      next: () => {
        this.cancelarEscolhaVideo(idx);
        this.enviandoVideos.set(false);
        this.snack.open('Vídeo removido!', 'OK', { duration: 3000 });
      },
      error: (e) => {
        this.enviandoVideos.set(false);
        this.snack.open(mensagemDeErro(e, 'Erro ao remover vídeo'), 'Fechar', { duration: 3000 });
      }
    });
  }

  private enviarVideoModulo(idx: number, moduloId: number, moduloGroup: FormGroup, file: File) {
    this.enviandoVideos.set(true);
    this.progressoPorModulo.update(m => { const n = new Map(m); n.set(idx, 0); return n; });
    this.uploadSvc.uploadModuloVideo(moduloId, file).subscribe({
      next: (event: HttpEvent<{ urlVideo: string }>) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const pct = Math.round((100 * event.loaded) / event.total);
          this.progressoPorModulo.update(m => { const n = new Map(m); n.set(idx, pct); return n; });
        } else if (event.type === HttpEventType.Response) {
          moduloGroup.patchValue({ urlVideo: event.body?.urlVideo ?? null, tipoVideo: 'ARQUIVO' });
          this.progressoPorModulo.update(m => { const n = new Map(m); n.delete(idx); return n; });
          this.enviandoVideos.set(false);
          this.snack.open('Vídeo enviado!', 'OK', { duration: 3000 });
        }
      },
      error: (e) => {
        this.progressoPorModulo.update(m => { const n = new Map(m); n.delete(idx); return n; });
        this.enviandoVideos.set(false);
        this.snack.open(mensagemDeErro(e, 'Erro ao enviar vídeo'), 'Fechar', { duration: 3000 });
      }
    });
  }

  getAulas(moduloId: number): AulaInfo[] {
    return this.aulasPorModulo()[moduloId] || [];
  }

  toggleAulasModulo(moduloId: number) {
    this.moduloAulasExpandido.set(this.moduloAulasExpandido() === moduloId ? null : moduloId);
    this.fecharFormAula();
  }

  abrirFormAula(moduloId: number, aula?: AulaInfo) {
    this.editandoAula.set(aula || null);
    this.aulaForm.reset({
      titulo: aula?.titulo || '',
      urlVideo: aula?.urlVideo || '',
      duracaoMin: aula?.duracaoMin ?? 0,
      ordem: aula?.ordem ?? (this.getAulas(moduloId).length + 1)
    });
    this.moduloAulaAtivo.set(moduloId);
  }

  fecharFormAula() {
    this.moduloAulaAtivo.set(null);
    this.editandoAula.set(null);
    this.aulaForm.reset();
  }

  salvarAula(moduloId: number) {
    if (this.aulaForm.invalid) return;
    this.salvandoAula.set(true);
    const v = this.aulaForm.value;
    const dados = {
      titulo: v.titulo!,
      urlVideo: v.urlVideo || null,
      duracaoMin: v.duracaoMin ?? 0,
      ordem: v.ordem ?? 1
    };

    const aula = this.editandoAula();
    const op = aula
      ? this.svc.atualizarAula(aula.id, dados)
      : this.svc.criarAula({ moduloId, ...dados });

    op.subscribe({
      next: (resultado) => {
        this.aulasPorModulo.update(m => {
          const lista = m[moduloId] || [];
          const atualizada = aula
            ? lista.map(a => a.id === resultado.id ? resultado : a)
            : [...lista, resultado];
          return { ...m, [moduloId]: atualizada };
        });
        this.snack.open(aula ? 'Aula atualizada!' : 'Aula criada!', 'OK', { duration: 3000 });
        this.salvandoAula.set(false);
        this.fecharFormAula();
      },
      error: (e) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao salvar aula'), 'Fechar', { duration: 3000 });
        this.salvandoAula.set(false);
      }
    });
  }

  excluirAula(moduloId: number, aula: AulaInfo) {
    if (!confirm(`Excluir a aula "${aula.titulo}"?`)) return;
    this.svc.deletarAula(aula.id).subscribe({
      next: () => {
        this.aulasPorModulo.update(m => ({ ...m, [moduloId]: (m[moduloId] || []).filter(a => a.id !== aula.id) }));
        this.snack.open('Aula excluída!', 'OK', { duration: 3000 });
      },
      error: (e) => this.snack.open(mensagemDeErro(e, 'Erro ao excluir aula'), 'Fechar', { duration: 3000 })
    });
  }

  salvar() {
    // A segunda checagem cobre submit via Enter, que não passa pelo [disabled]
    // do botão — sem ela um link de vídeo malformado ainda em edição escaparia
    // pro payload do curso.
    if (this.form.invalid || this.erroLinkVideo().size > 0) return;
    this.salvando.set(true);
    const v = this.form.value;

    const data = {
      titulo: v.titulo!,
      descricao: v.descricao || '',
      nivel: v.nivel!,
      unidadeId: v.unidadeId ?? null,
      areaId: v.areaId!,
      modulos: v.modulos && v.modulos.length > 0 ? v.modulos : [],
      categoriaIds: Array.from(this.categoriasSelecionadas()),
      tipoIds: Array.from(this.tiposSelecionados())
    };

    const isEdicao = !!this.editando();
    const op = isEdicao
      ? this.svc.atualizarCurso(this.editando()!.id, data)
      : this.svc.criarCurso(data);

    op.subscribe({
      next: (curso: CursoDetalhe) => {
        this.salvando.set(false);
        this.snack.open(isEdicao ? 'Curso atualizado!' : 'Curso criado!', 'OK', { duration: 3000 });

        const finalizar = () => { this.fecharForm(); this.carregarCursos(this.pageIndex()); };
        const imagem = this.imagemSelecionada();
        if (imagem) {
          this.uploadandoCapa.set(true);
          this.uploadSvc.uploadCurso(curso.id, imagem).subscribe({
            next: () => { this.uploadandoCapa.set(false); this.enviarVideosPendentes(curso, finalizar); },
            error: () => { this.uploadandoCapa.set(false); this.enviarVideosPendentes(curso, finalizar); }
          });
        } else {
          this.enviarVideosPendentes(curso, finalizar);
        }
      },
      error: () => { this.snack.open('Erro ao salvar curso', 'Fechar', { duration: 3000 }); this.salvando.set(false); }
    });
  }

  // Módulos novos só ganham id real na resposta do save — é só aqui que dá pra
  // disparar o upload dos vídeos que ficaram pendentes (ver onVideoSelected).
  // curso.modulos[idx] bate com o módulo enviado no índice idx do FormArray
  // porque a lista vem ordenada por "ordem ASC" e ordem == índice+1 (mantido
  // por adicionarModulo/removerModulo). Sequencial de propósito: cursos
  // normalmente têm poucos módulos com vídeo pendente por save.
  private enviarVideosPendentes(curso: CursoDetalhe, aoConcluir: () => void) {
    const pendentes = Array.from(this.videosPendentes().entries());
    if (pendentes.length === 0) { aoConcluir(); return; }

    this.enviandoVideos.set(true);
    let i = 0;
    const proximo = () => {
      if (i >= pendentes.length) {
        this.videosPendentes.set(new Map());
        this.enviandoVideos.set(false);
        aoConcluir();
        return;
      }
      const [idx, file] = pendentes[i];
      i++;
      const moduloResp = curso.modulos?.[idx];
      if (!moduloResp) { proximo(); return; }

      this.uploadSvc.uploadModuloVideo(moduloResp.id, file).subscribe({
        next: (event: HttpEvent<{ urlVideo: string }>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const pct = Math.round((100 * event.loaded) / event.total);
            this.progressoPorModulo.update(m => { const n = new Map(m); n.set(idx, pct); return n; });
          } else if (event.type === HttpEventType.Response) {
            this.progressoPorModulo.update(m => { const n = new Map(m); n.delete(idx); return n; });
            proximo();
          }
        },
        // O curso já foi salvo — uma falha aqui é só do vídeo daquele módulo,
        // não desfaz o save. Deixa o usuário tentar de novo depois, editando.
        error: (e) => {
          this.snack.open(mensagemDeErro(e, `Erro ao enviar vídeo do módulo ${idx + 1}`), 'Fechar', { duration: 4000 });
          this.progressoPorModulo.update(m => { const n = new Map(m); n.delete(idx); return n; });
          proximo();
        }
      });
    };
    proximo();
  }

  excluir(curso: Curso) {
    if (!confirm(`Desativar o curso "${curso.titulo}"?`)) return;
    this.svc.deletarCurso(curso.id).subscribe({
      next: () => { this.snack.open('Curso desativado!', 'OK', { duration: 3000 }); this.carregarCursos(this.pageIndex()); },
      error: () => this.snack.open('Erro ao desativar curso', 'Fechar', { duration: 3000 })
    });
  }

  toggleAlunos(cursoId: number) {
    if (this.cursoExpandido() === cursoId) {
      this.cursoExpandido.set(null);
      return;
    }
    this.mostrarForm.set(false);
    this.cursoExpandido.set(cursoId);
    this.carregarAlunos(cursoId);
  }

  carregarAlunos(cursoId: number) {
    this.loadingAlunos.set(cursoId);
    this.svc.listarMatriculasCurso(cursoId).subscribe({
      next: data => {
        this.matriculasCurso.update(m => ({ ...m, [cursoId]: data }));
        const notas: Record<number, string> = {};
        data.forEach(mat => { notas[mat.id] = mat.nota != null ? String(mat.nota) : ''; });
        this.notasEditando.update(n => ({ ...n, ...notas }));
        this.loadingAlunos.set(null);
      },
      error: () => this.loadingAlunos.set(null)
    });
  }

  getAlunos(cursoId: number): MatriculaDetalhe[] {
    return this.matriculasCurso()[cursoId] || [];
  }

  getNota(matriculaId: number): string {
    return this.notasEditando()[matriculaId] ?? '';
  }

  setNota(matriculaId: number, valor: string) {
    this.notasEditando.update(n => ({ ...n, [matriculaId]: valor }));
  }

  lancarNota(matricula: MatriculaDetalhe, cursoId: number) {
    const notaStr = this.getNota(matricula.id);
    const nota = parseFloat(notaStr);
    if (isNaN(nota) || nota < 0 || nota > 10) {
      this.snack.open('Nota inválida. Use um valor entre 0 e 10.', 'Fechar', { duration: 3000 });
      return;
    }
    this.salvandoNota.set(matricula.id);
    this.svc.lancarNota(matricula.id, nota).subscribe({
      next: () => {
        this.snack.open(`Nota ${nota} lançada para ${matricula.usuarioNome}!`, 'OK', { duration: 3000 });
        this.salvandoNota.set(null);
        this.carregarAlunos(cursoId);
      },
      error: () => {
        this.snack.open('Erro ao lançar nota', 'Fechar', { duration: 3000 });
        this.salvandoNota.set(null);
      }
    });
  }

  getNivelClass(nivel: string): string {
    const map: Record<string, string> = {
      BASICO: 'bg-green-100 text-sucesso',
      INTERMEDIARIO: 'bg-yellow-100 text-aviso',
      AVANCADO: 'bg-red-100 text-erro'
    };
    return map[nivel] || 'bg-superficie-2 text-texto';
  }

  getStatusClass(status: string): string {
    return status === 'CONCLUIDO' ? 'bg-green-100 text-sucesso' : 'bg-blue-100 text-marca';
  }

  trackById = (_: number, item: { id: number }) => item.id;
}
