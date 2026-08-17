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
