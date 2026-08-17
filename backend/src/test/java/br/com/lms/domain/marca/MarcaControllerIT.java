package br.com.lms.domain.marca;

import br.com.lms.IntegrationTestBase;
import br.com.lms.domain.usuario.Usuario;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Identidade visual da instalação.
 *
 * <p>O que estes testes travam é o contrato que sustenta o white-label: a
 * leitura precisa funcionar <b>sem autenticação</b> (a tela de login mostra o
 * logotipo do cliente antes de existir sessão) e a escrita precisa ser
 * exclusiva de ADMIN (nome e logotipo valem para todos os usuários, não são
 * preferência individual).
 */
class MarcaControllerIT extends IntegrationTestBase {

    private String json(Map<String, Object> m) throws Exception {
        return objectMapper.writeValueAsString(m);
    }

    private Map<String, Object> mapa(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private MockMultipartFile png() {
        return new MockMultipartFile("file", "logo.png", "image/png", new byte[] { 1, 2, 3 });
    }

    @Test
    @DisplayName("GET é público: a tela de login precisa da marca antes de haver sessão")
    void get_ehPublico() throws Exception {
        mockMvc.perform(get("/api/marca"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").exists());
    }

    @Test
    @DisplayName("A migration já deixa a linha criada — nunca existe estado 'sem marca'")
    void marcaPadrao_jaExisteNoPrimeiroBoot() throws Exception {
        mockMvc.perform(get("/api/marca"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("LMS"))
                .andExpect(jsonPath("$.logoUrl").doesNotExist())
                .andExpect(jsonPath("$.logoInversoUrl").doesNotExist());
    }

    @Test
    @DisplayName("ADMIN altera nome e assinatura, e a leitura pública reflete na hora (cache invalidado)")
    void adminAtualiza_eOCacheEInvalidado() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.marca@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        // aquece o cache de marca antes da escrita
        mockMvc.perform(get("/api/marca")).andExpect(status().isOk());

        mockMvc.perform(put("/api/marca").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(mapa("nome", "Acme Educação", "assinatura", "Educação corporativa"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Acme Educação"));

        entityManager.flush();
        entityManager.clear();

        // sem o @CacheEvict, isto ainda devolveria "LMS"
        mockMvc.perform(get("/api/marca"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Acme Educação"))
                .andExpect(jsonPath("$.assinatura").value("Educação corporativa"));
    }

    @Test
    @DisplayName("Assinatura em branco é normalizada para nulo, e não para string vazia")
    void assinaturaEmBranco_viraNulo() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.marca2@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        mockMvc.perform(put("/api/marca").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(mapa("nome", "Acme", "assinatura", "   "))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assinatura").doesNotExist());
    }

    @Test
    @DisplayName("Nome em branco é rejeitado: nenhuma tela pode ficar sem identidade")
    void nomeEmBranco_ehRejeitado() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.marca3@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        mockMvc.perform(put("/api/marca").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(mapa("nome", "   "))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("ALUNO não altera a identidade da instalação")
    void aluno_naoEscreve() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.marca@lms.com", "senha12345", Usuario.Role.ALUNO);
        String token = "Bearer " + tokenPara(aluno);

        mockMvc.perform(put("/api/marca").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(mapa("nome", "Invadido"))))
                .andExpect(status().is4xxClientError());

        mockMvc.perform(multipart("/api/marca/logo/PRINCIPAL").file(png())
                        .header("Authorization", token))
                .andExpect(status().is4xxClientError());

        mockMvc.perform(get("/api/marca"))
                .andExpect(jsonPath("$.nome").value(org.hamcrest.Matchers.not("Invadido")));
    }

    @Test
    @DisplayName("Visitante sem sessão não altera a identidade")
    void visitante_naoEscreve() throws Exception {
        mockMvc.perform(put("/api/marca")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(mapa("nome", "Invadido"))))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Logotipo é enviado por variante e removido de volta ao padrão")
    void cicloDeVidaDoLogotipo() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.marca4@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        mockMvc.perform(multipart("/api/marca/logo/INVERSO").file(png())
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoInversoUrl").exists())
                // a variante enviada não pode contaminar a outra
                .andExpect(jsonPath("$.logoUrl").doesNotExist());

        mockMvc.perform(delete("/api/marca/logo/INVERSO").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoInversoUrl").doesNotExist());
    }

    /** Payload mínimo e válido de tema, com as duas paletas completas. */
    private Map<String, Object> temaValido(String corMarca) {
        var cores = mapa(
            "marca", corMarca, "marcaEscura", "#1d4ed8", "marcaProfunda", "#1e3a8a",
            "marcaSuave", "#eff6ff", "destaque", "#f97316", "fundo", "#f8fafc",
            "superficie", "#ffffff", "superficie2", "#f1f5f9", "texto", "#0f172a",
            "textoSuave", "#64748b", "borda", "#e5e7eb", "sucesso", "#16a34a",
            "erro", "#e11d48", "aviso", "#f59e0b");
        var tipografia = mapa("fonteTitulo", "Roboto", "fonteCorpo", "Roboto",
                "escala", 1.0, "pesoTitulo", 700);
        var modo = mapa("cores", cores, "tipografia", tipografia);
        return mapa("claro", modo, "escuro", modo);
    }

    @Test
    @DisplayName("Tema nasce nulo (padrao de fabrica) e passa a ser devolvido depois de publicado")
    void tema_padraoEDepoisPublicado() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.tema@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        mockMvc.perform(get("/api/marca"))
                .andExpect(jsonPath("$.tema").doesNotExist());

        mockMvc.perform(put("/api/marca/tema").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(temaValido("#0a7d3f"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tema.claro.cores.marca").value("#0a7d3f"));

        // Força o INSERT/UPDATE a chegar ao banco e esvazia o contexto de
        // persistência. Sem isto o teste passava sem nunca escrever a coluna: a
        // transação é revertida no fim, o flush nunca acontecia e a leitura
        // seguinte vinha do cache de primeiro nível. Foi assim que um erro real
        // de mapeamento (String -> jsonb) escapou da suíte.
        entityManager.flush();
        entityManager.clear();

        // publico, e com o cache invalidado
        mockMvc.perform(get("/api/marca"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tema.claro.cores.marca").value("#0a7d3f"))
                .andExpect(jsonPath("$.tema.escuro.tipografia.pesoTitulo").value(700));
    }

    @Test
    @DisplayName("DELETE do tema devolve a instalacao ao padrao de fabrica")
    void tema_restauraDeFabrica() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.tema2@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        mockMvc.perform(put("/api/marca/tema").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(temaValido("#0a7d3f"))))
                .andExpect(status().isOk());

        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(delete("/api/marca/tema").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tema").doesNotExist());

        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/api/marca"))
                .andExpect(jsonPath("$.tema").doesNotExist());
    }

    @Test
    @DisplayName("Cor fora do formato hexadecimal e recusada: o valor vai parar em CSS no cliente")
    void tema_corInvalidaEhRecusada() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.tema3@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        // tentativa de injetar declaracao CSS extra pelo valor do token
        mockMvc.perform(put("/api/marca/tema").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(temaValido("red; background: url(http://x)"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/marca"))
                .andExpect(jsonPath("$.tema").doesNotExist());
    }

    @Test
    @DisplayName("Paleta incompleta e recusada: um token ausente deixaria parte da tela sem cor")
    void tema_paletaIncompletaEhRecusada() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.tema4@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        var incompleto = temaValido("#0a7d3f");
        @SuppressWarnings("unchecked")
        var claro = (Map<String, Object>) incompleto.get("claro");
        @SuppressWarnings("unchecked")
        var cores = (Map<String, Object>) claro.get("cores");
        cores.remove("borda");

        mockMvc.perform(put("/api/marca/tema").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(incompleto)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("ALUNO nao publica a paleta da instalacao")
    void tema_alunoNaoEscreve() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.tema@lms.com", "senha12345", Usuario.Role.ALUNO);
        String token = "Bearer " + tokenPara(aluno);

        mockMvc.perform(put("/api/marca/tema").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(temaValido("#0a7d3f"))))
                .andExpect(status().is4xxClientError());

        mockMvc.perform(delete("/api/marca/tema").header("Authorization", token))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("SVG é recusado: é documento executável, e aqui o logotipo só precisa ser imagem")
    void svg_ehRecusado() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.marca5@lms.com", "senha12345", Usuario.Role.ADMIN);
        String token = "Bearer " + tokenPara(admin);

        var svg = new MockMultipartFile("file", "logo.svg", "image/svg+xml",
                "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>".getBytes());

        mockMvc.perform(multipart("/api/marca/logo/PRINCIPAL").file(svg)
                        .header("Authorization", token))
                .andExpect(status().isBadRequest());
    }
}
