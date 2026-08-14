import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface CategoriaInfo { id: number; nome: string; slug: string; areaNome: string; areaSlug: string; }
export interface TipoCurso { id: number; nome: string; slug: string; }
export interface Area { id: number; nome: string; slug: string; categorias: CategoriaInfo[]; }
export interface Curso { id: number; titulo: string; descricao: string; nivel: string; criadoEm: string; unidadeId: number | null; unidadeNome: string | null; areaId: number | null; areaNome: string | null; imagemUrl: string | null; categorias: CategoriaInfo[]; tipos: TipoCurso[]; }
export interface AulaInfo { id: number; moduloId: number; titulo: string; urlVideo: string | null; duracaoMin: number; ordem: number; }
export type TipoVideoModulo = 'ARQUIVO' | 'YOUTUBE' | 'VIMEO';
export interface ModuloInfo { id: number; titulo: string; ordem: number; urlVideo: string | null; tipoVideo: TipoVideoModulo | null; aulas: AulaInfo[]; }
export interface CursoDetalhe extends Curso { modulos: ModuloInfo[]; }
/**
 * Shape do PagedModel do Spring Data. O backend passou a serializar Page com
 * `spring.data.web.pageable.serialization-mode=VIA_DTO`: os metadados saíram da
 * raiz e vivem em `page`. O formato antigo (PageImpl cru) era documentado pelo
 * próprio Spring como instável entre versões.
 */
export interface Page<T> {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
}
export interface Matricula { id: number; cursoId: number; cursoTitulo: string; status: string; matriculadoEm: string; }
export interface Progresso { matriculaId: number; aulasConcluidas: number; totalAulas: number; percentual: number; }
export interface Regiao { id: number; nome: string; totalUnidades: number; }
export interface Unidade { id: number; nome: string; slug: string; endereco: string; regiaoId: number; regiaoNome: string; imagemUrl: string | null; }
export interface UnidadeDetalhe { id: number; nome: string; slug: string; regiaoNome: string; areas: Area[]; tipos: TipoCurso[]; }
export interface Professor { id: number; nome: string; email: string; role: string; unidadeId: number | null; unidadeNome: string | null; }
export interface UsuarioResponse { id: number; nome: string; email: string; role: string; unidadeId: number | null; unidadeNome: string | null; avatarUrl: string | null; }
export interface ConteudoAula { id: number; titulo: string; tipo: string; conteudo: string; ordem: number; }
export interface Presenca { id: number; matriculaId: number; aulaId: number; presente: boolean; dataAula: string; }
export interface PresencaResumo { matriculaId: number; presencas: number; totalAulas: number; percentual: number; }
export interface NotaResponse { matriculaId: number; nota: number; aprovado: boolean; lancadaEm: string; }
export interface MatriculaDetalhe { id: number; usuarioId: number; usuarioNome: string; usuarioEmail: string; status: string; matriculadoEm: string; nota: number | null; aprovado: boolean | null; notaLancadaEm: string | null; }

@Injectable({ providedIn: 'root' })
export class CursoService {
  constructor(private http: HttpClient) {}

  // --- Áreas e Tipos ---
  listarAreas() {
    return this.http.get<Area[]>(`${environment.apiUrl}/areas`);
  }

  buscarArea(slug: string) {
    return this.http.get<Area>(`${environment.apiUrl}/areas/${slug}`);
  }

  listarCursosPorCategoria(areaSlug: string, categoriaSlug: string, page = 0) {
    const params = new HttpParams().set('page', page).set('size', 10);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/areas/${areaSlug}/${categoriaSlug}`, { params });
  }

  listarTipos() {
    return this.http.get<TipoCurso[]>(`${environment.apiUrl}/tipos`);
  }

  listarCursosPorTipo(tipoSlug: string, page = 0) {
    const params = new HttpParams().set('page', page).set('size', 10);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/tipos/${tipoSlug}/cursos`, { params });
  }

  listarTodosCursosTipo(tipoSlug: string) {
    const params = new HttpParams().set('size', 100);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/tipos/${tipoSlug}/cursos`, { params });
  }

  listarCursosDaArea(areaSlug: string) {
    const params = new HttpParams().set('areaSlug', areaSlug).set('size', 100);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/cursos`, { params });
  }

  buscarUnidade(slug: string) {
    return this.http.get<UnidadeDetalhe>(`${environment.apiUrl}/unidades/${slug}`);
  }

  listarCursosDaUnidade(slug: string, filtros?: { tipoSlug?: string; areaSlug?: string }) {
    let params = new HttpParams().set('size', 100);
    if (filtros?.tipoSlug) params = params.set('tipoSlug', filtros.tipoSlug);
    if (filtros?.areaSlug) params = params.set('areaSlug', filtros.areaSlug);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/unidades/${slug}/cursos`, { params });
  }

  // --- Cursos ---
  listarTodosCursos() {
    const params = new HttpParams().set('page', 0).set('size', 200);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/cursos`, { params });
  }

  /** Listagem paginada usada pelo painel admin — não carrega tudo de uma vez. */
  listarCursosAdmin(page = 0, size = 10, q?: string) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/cursos`, { params });
  }

  listarCursos(page = 0, nivel?: string, unidadeId?: number, q?: string) {
    let params = new HttpParams().set('page', page).set('size', 10);
    if (nivel) params = params.set('nivel', nivel);
    if (unidadeId) params = params.set('unidadeId', unidadeId);
    if (q) params = params.set('q', q);
    return this.http.get<Page<Curso>>(`${environment.apiUrl}/cursos`, { params });
  }

  buscarCurso(id: number) {
    return this.http.get<CursoDetalhe>(`${environment.apiUrl}/cursos/${id}`);
  }

  // Retorno é CursoDetalhe (não Curso): o backend passou a incluir os módulos
  // com id real na resposta de criar/atualizar, necessário para disparar o
  // upload dos vídeos que ficaram pendentes de módulos ainda sem id no momento
  // do submit (ver AdminCursosComponent.salvar).
  criarCurso(data: { titulo: string; descricao: string; nivel: string; unidadeId: number | null; areaId: number; modulos?: any[]; categoriaIds?: number[]; tipoIds?: number[] }) {
    return this.http.post<CursoDetalhe>(`${environment.apiUrl}/cursos`, data);
  }

  atualizarCurso(id: number, data: { titulo: string; descricao: string; nivel: string; unidadeId: number | null; areaId: number; modulos?: any[]; categoriaIds?: number[]; tipoIds?: number[] }) {
    return this.http.put<CursoDetalhe>(`${environment.apiUrl}/cursos/${id}`, data);
  }

  deletarCurso(id: number) {
    return this.http.delete(`${environment.apiUrl}/cursos/${id}`);
  }

  // --- Matrículas ---
  matricular(cursoId: number) {
    return this.http.post<Matricula>(`${environment.apiUrl}/matriculas`, { cursoId });
  }

  minhasMatriculas() {
    return this.http.get<Matricula[]>(`${environment.apiUrl}/matriculas/minhas`);
  }

  progresso(matriculaId: number) {
    return this.http.get<Progresso>(`${environment.apiUrl}/matriculas/${matriculaId}/progresso`);
  }

  lancarNota(matriculaId: number, nota: number) {
    return this.http.patch<NotaResponse>(`${environment.apiUrl}/matriculas/${matriculaId}/nota`, { nota });
  }

  // --- Usuários ---
  listarUsuarios() {
    return this.http.get<UsuarioResponse[]>(`${environment.apiUrl}/usuarios`);
  }

  criarUsuario(data: { nome: string; email: string; senha: string }) {
    return this.http.post<any>(`${environment.apiUrl}/auth/register`, data);
  }

  atualizarUsuario(id: number, data: { nome: string; email: string; role: string; unidadeId: number | null }) {
    return this.http.put<UsuarioResponse>(`${environment.apiUrl}/usuarios/${id}`, data);
  }

  uploadAvatar(usuarioId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UsuarioResponse>(`${environment.apiUrl}/usuarios/${usuarioId}/foto`, form);
  }

  atualizarRole(id: number, role: string) {
    return this.http.patch<any>(`${environment.apiUrl}/usuarios/${id}/role`, { role });
  }

  listarMatriculasCurso(cursoId: number) {
    return this.http.get<MatriculaDetalhe[]>(`${environment.apiUrl}/matriculas/curso/${cursoId}`);
  }

  // --- Regiões ---
  listarRegioes() {
    return this.http.get<Regiao[]>(`${environment.apiUrl}/regioes`);
  }

  criarRegiao(nome: string) {
    return this.http.post<Regiao>(`${environment.apiUrl}/regioes`, { nome });
  }

  atualizarRegiao(id: number, nome: string) {
    return this.http.put<Regiao>(`${environment.apiUrl}/regioes/${id}`, { nome });
  }

  deletarRegiao(id: number) {
    return this.http.delete(`${environment.apiUrl}/regioes/${id}`);
  }

  // --- Unidades ---
  listarUnidades(regiaoId: number) {
    return this.http.get<Unidade[]>(`${environment.apiUrl}/regioes/${regiaoId}/unidades`);
  }

  listarTodasUnidades() {
    return this.http.get<Unidade[]>(`${environment.apiUrl}/regioes/unidades`);
  }

  criarUnidade(regiaoId: number, data: { nome: string; endereco: string }) {
    return this.http.post<Unidade>(`${environment.apiUrl}/regioes/${regiaoId}/unidades`, { ...data, regiaoId });
  }

  atualizarUnidade(regiaoId: number, unidadeId: number, data: { nome: string; endereco: string }) {
    return this.http.put<Unidade>(`${environment.apiUrl}/regioes/${regiaoId}/unidades/${unidadeId}`, { ...data, regiaoId });
  }

  deletarUnidade(regiaoId: number, unidadeId: number) {
    return this.http.delete(`${environment.apiUrl}/regioes/${regiaoId}/unidades/${unidadeId}`);
  }

  // --- Professores ---
  listarProfessores() {
    return this.http.get<Professor[]>(`${environment.apiUrl}/professores`);
  }

  cursosDoProfessor(professorId: number) {
    return this.http.get<Curso[]>(`${environment.apiUrl}/professores/${professorId}/cursos`);
  }

  meusCursosProfessor() {
    return this.http.get<Curso[]>(`${environment.apiUrl}/professores/meus-cursos`);
  }

  vincularProfessorCurso(professorId: number, cursoId: number) {
    return this.http.post(`${environment.apiUrl}/professores/${professorId}/cursos`, { cursoId });
  }

  desvincularProfessorCurso(professorId: number, cursoId: number) {
    return this.http.delete(`${environment.apiUrl}/professores/${professorId}/cursos/${cursoId}`);
  }

  // --- Aulas ---
  criarAula(data: { moduloId: number; titulo: string; urlVideo: string | null; duracaoMin: number; ordem: number }) {
    return this.http.post<AulaInfo>(`${environment.apiUrl}/aulas`, data);
  }

  atualizarAula(id: number, data: { titulo: string; urlVideo: string | null; duracaoMin: number; ordem: number }) {
    return this.http.put<AulaInfo>(`${environment.apiUrl}/aulas/${id}`, data);
  }

  deletarAula(id: number) {
    return this.http.delete(`${environment.apiUrl}/aulas/${id}`);
  }

  // --- Conteúdo das Aulas ---
  listarConteudos(aulaId: number) {
    return this.http.get<ConteudoAula[]>(`${environment.apiUrl}/aulas/${aulaId}/conteudos`);
  }

  criarConteudo(aulaId: number, data: { titulo: string; tipo: string; conteudo: string; ordem: number }) {
    return this.http.post<ConteudoAula>(`${environment.apiUrl}/aulas/${aulaId}/conteudos`, data);
  }

  deletarConteudo(aulaId: number, conteudoId: number) {
    return this.http.delete(`${environment.apiUrl}/aulas/${aulaId}/conteudos/${conteudoId}`);
  }

  // --- Presença ---
  registrarPresenca(data: { matriculaId: number; aulaId: number; presente: boolean; dataAula: string }) {
    return this.http.post<Presenca>(`${environment.apiUrl}/presenca`, data);
  }

  presencaPorMatricula(matriculaId: number) {
    return this.http.get<Presenca[]>(`${environment.apiUrl}/presenca/matricula/${matriculaId}`);
  }

  resumoPresenca(matriculaId: number) {
    return this.http.get<PresencaResumo>(`${environment.apiUrl}/presenca/matricula/${matriculaId}/resumo`);
  }
}
