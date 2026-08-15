import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AdminCursosComponent } from './admin-cursos.component';
import { CursoService, Curso, Page, Area, Unidade, TipoCurso } from '../../../core/services/curso.service';
import { UploadService } from '../../../core/services/upload.service';
import { criarMock, Mocked } from '../../../../testing/mock';

/**
 * O painel carregava os 200 primeiros cursos de uma vez (listarTodosCursos,
 * size fixo) sem paginação visível. Estes testes travam o contrato com o
 * backend paginado: page/size corretos a cada troca de página, e o filtro
 * de busca sempre reiniciando a paginação em 0 — senão o usuário filtra e
 * continua vendo a página 3 de um resultado que pode ter só 1 página.
 */
describe('AdminCursosComponent', () => {
  let cursoServiceSpy: Mocked<CursoService>;
  let uploadServiceSpy: Mocked<UploadService>;
  let snackSpy: Mocked<MatSnackBar>;

  const paginaVazia: Page<Curso> = {
    content: [],
    page: { size: 10, number: 0, totalElements: 0, totalPages: 0 }
  };

  beforeEach(() => {
    cursoServiceSpy = criarMock<CursoService>([
      'listarCursosAdmin', 'listarTodasUnidades', 'listarAreas', 'listarTipos'
    ]);
    uploadServiceSpy = criarMock<UploadService>(['uploadCurso']);
    snackSpy = criarMock<MatSnackBar>(['open']);

    cursoServiceSpy.listarCursosAdmin.mockReturnValue(of(paginaVazia));
    cursoServiceSpy.listarTodasUnidades.mockReturnValue(of([] as Unidade[]));
    cursoServiceSpy.listarAreas.mockReturnValue(of([] as Area[]));
    cursoServiceSpy.listarTipos.mockReturnValue(of([] as TipoCurso[]));

    TestBed.configureTestingModule({
      imports: [AdminCursosComponent],
      providers: [
        { provide: CursoService, useValue: cursoServiceSpy },
        { provide: UploadService, useValue: uploadServiceSpy },
        { provide: MatSnackBar, useValue: snackSpy }
      ]
    });
  });

  /** Cria o fixture e dispara o ngOnInit (que já carrega a página 0). */
  function montar() {
    const fixture = TestBed.createComponent(AdminCursosComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function pageEvent(parcial: Partial<PageEvent>): PageEvent {
    return { pageIndex: 0, pageSize: 10, length: 0, ...parcial };
  }

  it('ao iniciar, carrega a página 0 com o tamanho padrão e sem filtro', () => {
    montar();

    expect(cursoServiceSpy.listarCursosAdmin).toHaveBeenCalledWith(0, 10, undefined);
  });

  it('troca de página dispara chamada com os params corretos', () => {
    const componente = montar();
    cursoServiceSpy.listarCursosAdmin.mockClear();

    componente.onPage(pageEvent({ pageIndex: 2, pageSize: 25 }));

    expect(cursoServiceSpy.listarCursosAdmin).toHaveBeenCalledWith(2, 25, undefined);
    expect(componente.pageIndex()).toBe(2);
    expect(componente.pageSize()).toBe(25);
  });

  it('mudança de filtro reseta para página 0', () => {
    vi.useFakeTimers();
    try {
      const componente = montar();
      // avança para uma página != 0 antes de aplicar o filtro
      componente.onPage(pageEvent({ pageIndex: 3, pageSize: 10 }));
      cursoServiceSpy.listarCursosAdmin.mockClear();

      componente.onFiltroChange('postgres');
      vi.advanceTimersByTime(300);

      expect(cursoServiceSpy.listarCursosAdmin).toHaveBeenCalledWith(0, 10, 'postgres');
      expect(componente.pageIndex()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounça o filtro: só chama o backend depois de parar de digitar', () => {
    vi.useFakeTimers();
    try {
      const componente = montar();
      cursoServiceSpy.listarCursosAdmin.mockClear();

      componente.onFiltroChange('post');
      vi.advanceTimersByTime(100);
      componente.onFiltroChange('postgres');
      vi.advanceTimersByTime(100);

      expect(cursoServiceSpy.listarCursosAdmin).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(cursoServiceSpy.listarCursosAdmin).toHaveBeenCalledTimes(1);
      expect(cursoServiceSpy.listarCursosAdmin).toHaveBeenCalledWith(0, 10, 'postgres');
    } finally {
      vi.useRealTimers();
    }
  });

  it('filtro em branco não envia o parâmetro q', () => {
    const componente = montar();
    cursoServiceSpy.listarCursosAdmin.mockClear();

    componente.filtro.set('   ');
    componente.carregarCursos(0);

    expect(cursoServiceSpy.listarCursosAdmin).toHaveBeenCalledWith(0, 10, undefined);
  });
});
