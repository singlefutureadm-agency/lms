package br.com.lms.domain.matricula;

import br.com.lms.IntegrationTestBase;
import br.com.lms.domain.curso.Curso;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.MarcarAulaRequest;
import br.com.lms.dto.DTOs.MatriculaRequest;
import br.com.lms.dto.DTOs.NotaRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MatriculaControllerIT extends IntegrationTestBase {

    @Test
    void matricular_alunoEmCurso_retornaCriado() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno@teste.com", "senha123", Usuario.Role.ALUNO);
        Curso curso = criarCurso("Curso Teste");

        mockMvc.perform(post("/api/matriculas")
                        .header("Authorization", "Bearer " + tokenPara(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new MatriculaRequest(curso.getId()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cursoId").value(curso.getId()))
                .andExpect(jsonPath("$.status").value("EM_ANDAMENTO"));
    }

    @Test
    void matricular_duplicado_respeitaUniqueUsuarioCurso_retorna409() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno2@teste.com", "senha123", Usuario.Role.ALUNO);
        Curso curso = criarCurso("Curso Teste 2");
        String auth = "Bearer " + tokenPara(aluno);
        String body = objectMapper.writeValueAsString(new MatriculaRequest(curso.getId()));

        mockMvc.perform(post("/api/matriculas")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        // Mesmo usuario_id + curso_id (UNIQUE constraint da tabela matriculas) — deve ser rejeitado
        mockMvc.perform(post("/api/matriculas")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void lancarNota_maiorOuIgual6_aprovaAutomaticamente() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno3@teste.com", "senha123", Usuario.Role.ALUNO);
        Usuario professor = criarUsuario("Prof", "prof@teste.com", "senha123", Usuario.Role.PROFESSOR);
        Curso curso = criarCurso("Curso Nota");
        Matricula matricula = matricular(aluno, curso);

        mockMvc.perform(patch("/api/matriculas/{id}/nota", matricula.getId())
                        .header("Authorization", "Bearer " + tokenPara(professor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new NotaRequest(new BigDecimal("6.0")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aprovado").value(true));
    }

    @Test
    void lancarNota_menorQue6_reprovaAutomaticamente() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno4@teste.com", "senha123", Usuario.Role.ALUNO);
        Usuario professor = criarUsuario("Prof", "prof2@teste.com", "senha123", Usuario.Role.PROFESSOR);
        Curso curso = criarCurso("Curso Nota 2");
        Matricula matricula = matricular(aluno, curso);

        mockMvc.perform(patch("/api/matriculas/{id}/nota", matricula.getId())
                        .header("Authorization", "Bearer " + tokenPara(professor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new NotaRequest(new BigDecimal("5.9")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aprovado").value(false));
    }

    @Test
    void marcarAula_comAulaInexistente_retorna404() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno6@teste.com", "senha123", Usuario.Role.ALUNO);
        Curso curso = criarCurso("Curso Marcar Aula");
        Matricula matricula = matricular(aluno, curso);

        mockMvc.perform(post("/api/matriculas/progresso")
                        .header("Authorization", "Bearer " + tokenPara(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new MarcarAulaRequest(matricula.getId(), 999999L))))
                .andExpect(status().isNotFound());
    }

    @Test
    void listarMatriculasPorCurso_comoAluno_retorna403() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno5@teste.com", "senha123", Usuario.Role.ALUNO);
        Curso curso = criarCurso("Curso Restrito");

        mockMvc.perform(get("/api/matriculas/curso/{cursoId}", curso.getId())
                        .header("Authorization", "Bearer " + tokenPara(aluno)))
                .andExpect(status().isForbidden());
    }
}
