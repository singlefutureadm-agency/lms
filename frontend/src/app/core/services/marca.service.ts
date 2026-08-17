import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TemaService, type TemaDaInstalacao } from './tema.service';

/**
 * Identidade visual do cliente: nome, assinatura e logotipos.
 *
 * Isto é a metade "quem é o cliente" do white-label; a outra metade — cores e
 * tipografia — é do {@link TemaService}. Os dois são deliberadamente separados:
 * a paleta muda com o modo claro/escuro, a identidade não.
 *
 * ## Persistência
 * O servidor é a fonte da verdade (`/api/marca`): identidade é configuração da
 * INSTALAÇÃO, não preferência de quem está usando — um administrador a define
 * uma vez e vale para todos, inclusive para o visitante que ainda não entrou.
 *
 * O `localStorage` continua no fluxo, mas só como **cache de primeira pintura**:
 * sem ele, toda abertura mostraria o nome padrão por um instante até a resposta
 * do GET chegar. O valor local nunca é a verdade — é sobrescrito assim que a
 * API responde.
 */

export interface Marca {
  /** Nome do cliente/produto. Aparece na barra, no login e na aba do navegador. */
  nome: string;
  /** Frase curta de apoio: subtítulo do login e do rodapé. Pode ficar vazia. */
  assinatura: string;
  /** Logo para fundos claros (barra pública, login). Vazio = ícone genérico. */
  logo: string;
  /** Logo para fundos escuros/cor da marca. Vazio = usa {@link logo}. */
  logoInverso: string;
}

/** Shape de `MarcaResponse` no backend. */
interface MarcaResponseApi {
  nome: string;
  assinatura: string | null;
  logoUrl: string | null;
  logoInversoUrl: string | null;
  /** `null` = instalação nunca customizada; vale o padrão de fábrica. */
  tema: TemaDaInstalacao | null;
}

export type VarianteLogo = 'PRINCIPAL' | 'INVERSO';

export const MARCA_PADRAO: Marca = {
  nome: 'LMS',
  assinatura: 'Sistema de Gestão de Cursos',
  logo: '',
  logoInverso: '',
};

/**
 * Teto por arquivo. Não é o limite do servidor (que é maior) — é um filtro de
 * conveniência para o administrador descobrir na hora, e não depois do upload,
 * que escolheu um arquivo grande demais para um logotipo.
 */
export const LOGO_MAX_BYTES = 512 * 1024;

/**
 * SVG ficou de fora de propósito. Um SVG é um documento capaz de carregar
 * script, e o backend serve os uploads como arquivos estáticos: aceitá-lo seria
 * abrir um vetor de XSS armazenado por um formato que aqui só precisa ser
 * imagem. O `UploadService` do backend aplica a mesma lista.
 */
export const LOGO_TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];

const CHAVE_CACHE = 'lms_marca';

@Injectable({ providedIn: 'root' })
export class MarcaService {
  private readonly doc = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  /**
   * A paleta chega no mesmo GET da identidade — são a mesma configuração de
   * aparência da instalação, e separá-las em duas chamadas só adicionaria uma
   * ida ao servidor no caminho crítico de abertura. Este serviço é quem busca;
   * o TemaService é quem aplica.
   */
  private readonly tema = inject(TemaService);

  readonly marca = signal<Marca>(this.lerCache());
  /** Falso até a primeira resposta do servidor — o que está em tela é o cache. */
  readonly sincronizada = signal(false);

  /** Nome já protegido contra configuração vazia — nenhuma tela mostra em branco. */
  readonly nome = computed(() => this.marca().nome.trim() || MARCA_PADRAO.nome);
  readonly assinatura = computed(() => this.marca().assinatura.trim());

  /** Logo sobre a cor da marca / fundos escuros, com queda para o principal. */
  readonly logoInversoEfetivo = computed(() => {
    const m = this.marca();
    return m.logoInverso || m.logo || '';
  });

  readonly temLogo = computed(() => !!this.marca().logo || !!this.marca().logoInverso);

  constructor() {
    effect(() => {
      const marca = this.marca();
      this.aplicarNoDocumento(marca);
      this.gravarCache(marca);
    });
    this.carregar();
  }

  /** Lê do servidor e substitui o que veio do cache. */
  carregar(): void {
    this.http.get<MarcaResponseApi>(`${environment.apiUrl}/marca`).subscribe({
      next: resposta => {
        this.marca.set(this.daApi(resposta));
        this.tema.aplicarDaInstalacao(resposta.tema);
        this.sincronizada.set(true);
      },
      // Sem rede, o cache local segue valendo para esta sessão — a aplicação
      // abre com a marca certa mesmo com o backend fora do ar.
      error: () => this.sincronizada.set(false),
    });
  }

  /** Nome e assinatura. Exige ADMIN no servidor. */
  salvar(dados: { nome: string; assinatura: string }): Observable<MarcaResponseApi> {
    return this.http.put<MarcaResponseApi>(`${environment.apiUrl}/marca`, dados)
      .pipe(tap(resposta => this.marca.set(this.daApi(resposta))));
  }

  enviarLogo(variante: VarianteLogo, file: File): Observable<MarcaResponseApi> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<MarcaResponseApi>(`${environment.apiUrl}/marca/logo/${variante}`, form)
      .pipe(tap(resposta => this.marca.set(this.daApi(resposta))));
  }

  removerLogo(variante: VarianteLogo): Observable<MarcaResponseApi> {
    return this.http.delete<MarcaResponseApi>(`${environment.apiUrl}/marca/logo/${variante}`)
      .pipe(tap(resposta => this.marca.set(this.daApi(resposta))));
  }

  /** Publica a paleta e a tipografia atuais para toda a instalação. Exige ADMIN. */
  salvarTema(tema: TemaDaInstalacao): Observable<MarcaResponseApi> {
    return this.http.put<MarcaResponseApi>(`${environment.apiUrl}/marca/tema`, tema)
      .pipe(tap(resposta => this.tema.aplicarDaInstalacao(resposta.tema)));
  }

  /** Devolve a instalação ao padrão de fábrica do produto. Exige ADMIN. */
  restaurarTema(): Observable<MarcaResponseApi> {
    return this.http.delete<MarcaResponseApi>(`${environment.apiUrl}/marca/tema`)
      .pipe(tap(resposta => this.tema.aplicarDaInstalacao(resposta.tema)));
  }

  /** Valida antes de enviar, para o administrador errar barato. */
  validarArquivo(file: File): string | null {
    if (!LOGO_TIPOS_ACEITOS.includes(file.type)) return 'Formato inválido. Use PNG, JPG ou WebP.';
    if (file.size > LOGO_MAX_BYTES) return `Arquivo muito grande. Máximo ${Math.round(LOGO_MAX_BYTES / 1024)}KB.`;
    return null;
  }

  private daApi(r: MarcaResponseApi): Marca {
    return {
      nome: r.nome ?? MARCA_PADRAO.nome,
      assinatura: r.assinatura ?? '',
      logo: r.logoUrl ?? '',
      logoInverso: r.logoInversoUrl ?? '',
    };
  }

  /**
   * Título da aba e favicon acompanham a marca — são as duas superfícies fora
   * do Angular onde o cliente antigo continuaria aparecendo.
   */
  private aplicarNoDocumento(marca: Marca): void {
    this.doc.title = marca.nome.trim() || MARCA_PADRAO.nome;

    const icone = marca.logo || marca.logoInverso;
    if (!icone) return;
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'icon';
      this.doc.head.appendChild(link);
    }
    link.href = icone;
  }

  private lerCache(): Marca {
    try {
      const bruto = localStorage.getItem(CHAVE_CACHE);
      if (!bruto) return { ...MARCA_PADRAO };
      return { ...MARCA_PADRAO, ...(JSON.parse(bruto) as Partial<Marca>) };
    } catch {
      return { ...MARCA_PADRAO };
    }
  }

  private gravarCache(marca: Marca): void {
    try {
      localStorage.setItem(CHAVE_CACHE, JSON.stringify(marca));
    } catch {
      // Storage bloqueado: só perde a pintura imediata na próxima abertura.
    }
  }
}
