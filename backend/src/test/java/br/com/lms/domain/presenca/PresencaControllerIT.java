package br.com.lms.domain.presenca;

import br.com.lms.IntegrationTestBase;
import br.com.lms.domain.curso.Aula;
import br.com.lms.domain.curso.Curso;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.PresencaRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PresencaControllerIT extends IntegrationTestBase {

    @Test
    void registrarPresenca_criarEDepoisAtualizar_fazUpsertRespeitandoUnique() throws Exception {
        Usuario professor = criarUsuario("Prof", "prof@teste.com", "senha123", Usuario.Role.PROFESSOR);
        Usuario aluno = criarUsuario("Aluno", "aluno@teste.com", "senha123", Usuario.Role.ALUNO);
        Aula aula = criarCursoComAula("Curso Presença");
        Matricula matricula = matricular(aluno, aula.getModulo().getCurso());
        LocalDate dataAula = LocalDate.now();
        String auth = "Bearer " + tokenPara(professor);

        String primeiraResposta = mockMvc.perform(post("/api/presenca")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PresencaRequest(matricula.getId(), aula.getId(), true, dataAula))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.presente").value(true))
                .andReturn().getResponse().getContentAsString();

        long presencaId = objectMapper.readTree(primeiraResposta).get("id").asLong();

        // Mesma chave (matricula_id, aula_id, data_aula) — UNIQUE constraint da tabela
        // presencas_aula — deve atualizar o registro existente (upsert), não criar outro.
        mockMvc.perform(post("/api/presenca")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PresencaRequest(matricula.getId(), aula.getId(), false, dataAula))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(presencaId))
                .andExpect(jsonPath("$.presente").value(false));

        assertEquals(1, presencaAulaRepository.findByMatriculaId(matricula.getId()).size());
    }

    @Test
    void registrarPresenca_comAulaInexistente_retorna404() throws Exception {
        Usuario professor = criarUsuario("Prof", "prof.pres404@teste.com", "senha123", Usuario.Role.PROFESSOR);
        Usuario aluno = criarUsuario("Aluno", "aluno.pres404@teste.com", "senha123", Usuario.Role.ALUNO);
        Curso curso = criarCurso("Curso Presença 404");
        Matricula matricula = matricular(aluno, curso);

        mockMvc.perform(post("/api/presenca")
                        .header("Authorization", "Bearer " + tokenPara(professor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PresencaRequest(matricula.getId(), 999999L, true, LocalDate.now()))))
                .andExpect(status().isNotFound());
    }
}
