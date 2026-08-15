package br.com.lms.domain.curso;

import br.com.lms.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Busca textual em GET /api/cursos?q=... (V18, tsvector gerado sobre
 * titulo/descricao). Os termos usados aqui vêm do seed rico (V12) — ver lá
 * para conferir em qual campo cada um aparece.
 */
class CursoBuscaIT extends IntegrationTestBase {

    @Test
    @DisplayName("Busca por termo presente no título encontra o curso")
    void buscarPorTexto_termoNoTitulo_encontraCurso() throws Exception {
        // "PostgreSQL" está no título de "Banco de Dados com PostgreSQL"
        mockMvc.perform(get("/api/cursos?q=PostgreSQL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.titulo=='Banco de Dados com PostgreSQL')]").exists());
    }

    @Test
    @DisplayName("Busca por termo presente só na descrição encontra o curso")
    void buscarPorTexto_termoNaDescricao_encontraCurso() throws Exception {
        // "infraestrutura" só aparece na descrição de "Redes de Computadores"
        // ("...gerenciar infraestruturas de redes..."), não no título.
        mockMvc.perform(get("/api/cursos?q=infraestrutura"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.titulo=='Redes de Computadores')]").exists());
    }

    @Test
    @DisplayName("Busca por termo ausente retorna lista vazia, não erro")
    void buscarPorTexto_termoAusente_retornaVazio() throws Exception {
        mockMvc.perform(get("/api/cursos?q=xilofoneinexistente"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.page.totalElements").value(0));
    }

    @Test
    @DisplayName("Busca combinada com filtro de área aplica os dois: some quando a área não bate")
    void buscarPorTexto_combinadaComFiltroDeArea_aplicaAmbos() throws Exception {
        mockMvc.perform(get("/api/cursos?q=PostgreSQL&areaSlug=tecnologia-da-informacao"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.titulo=='Banco de Dados com PostgreSQL')]").exists());

        // Mesmo termo, área errada (o curso é de TI, não de saúde) — o AND dos
        // dois filtros precisa zerar o resultado, não ignorar a área.
        mockMvc.perform(get("/api/cursos?q=PostgreSQL&areaSlug=saude"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }
}
