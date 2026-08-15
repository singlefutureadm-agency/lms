package br.com.lms.domain.curso;

import br.com.lms.IntegrationTestBase;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.AtualizarAulaRequest;
import br.com.lms.dto.DTOs.CriarAulaRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * CRUD de Aula. Antes desta classe não havia nenhum fluxo que populasse a
 * tabela {@code aulas} fora do merge de módulos em PUT /api/cursos.
 */
class AulaControllerIT extends IntegrationTestBase {

    @Test
    void criar_aulaVinculadaAModulo_retornaCriada() throws Exception {
        Usuario professor = criarUsuario("Prof", "prof.aula.criar@lms.com", "senha12345", Usuario.Role.PROFESSOR);
        Modulo modulo = criarModulo("Curso para aula nova");

        mockMvc.perform(post("/api/aulas")
                        .header("Authorization", "Bearer " + tokenPara(professor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CriarAulaRequest(modulo.getId(), "Aula Nova", "https://video/1", 15, 1))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.moduloId").value(modulo.getId()))
                .andExpect(jsonPath("$.titulo").value("Aula Nova"))
                .andExpect(jsonPath("$.urlVideo").value("https://video/1"))
                .andExpect(jsonPath("$.duracaoMin").value(15))
                .andExpect(jsonPath("$.ordem").value(1));
    }

    @Test
    void criar_semModuloExistente_retorna404() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.aula.404@lms.com", "senha12345", Usuario.Role.ADMIN);

        mockMvc.perform(post("/api/aulas")
                        .header("Authorization", "Bearer " + tokenPara(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CriarAulaRequest(999999L, "X", null, null, null))))
                .andExpect(status().isNotFound());
    }

    @Test
    void buscarPorId_existente_retornaAula() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.aula.buscar@lms.com", "senha12345", Usuario.Role.ADMIN);
        Aula aula = criarCursoComAula("Curso busca aula");

        mockMvc.perform(get("/api/aulas/{id}", aula.getId())
                        .header("Authorization", "Bearer " + tokenPara(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(aula.getId()))
                .andExpect(jsonPath("$.titulo").value("Aula 1"));
    }

    @Test
    void buscarPorId_inexistente_retorna404() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.aula.buscar404@lms.com", "senha12345", Usuario.Role.ADMIN);

        mockMvc.perform(get("/api/aulas/{id}", 999999)
                        .header("Authorization", "Bearer " + tokenPara(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void atualizar_editaCamposDaAula() throws Exception {
        Usuario professor = criarUsuario("Prof", "prof.aula.upd@lms.com", "senha12345", Usuario.Role.PROFESSOR);
        Aula aula = criarCursoComAula("Curso update aula");

        mockMvc.perform(put("/api/aulas/{id}", aula.getId())
                        .header("Authorization", "Bearer " + tokenPara(professor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new AtualizarAulaRequest("Aula Editada", "https://video/editado", 45, 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.titulo").value("Aula Editada"))
                .andExpect(jsonPath("$.urlVideo").value("https://video/editado"))
                .andExpect(jsonPath("$.duracaoMin").value(45))
                .andExpect(jsonPath("$.ordem").value(2));
    }

    @Test
    void excluir_semHistorico_removeAula() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.aula.del@lms.com", "senha12345", Usuario.Role.ADMIN);
        Aula aula = criarCursoComAula("Curso delete aula");

        mockMvc.perform(delete("/api/aulas/{id}", aula.getId())
                        .header("Authorization", "Bearer " + tokenPara(admin)))
                .andExpect(status().isNoContent());

        assertThat(aulaRepository.findById(aula.getId())).isEmpty();
    }

    @Test
    void excluir_comProgressoRegistrado_retorna409() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.aula.del409a@lms.com", "senha12345", Usuario.Role.ADMIN);
        Usuario aluno = criarUsuario("Aluno", "aluno.aula.del409a@lms.com", "senha12345", Usuario.Role.ALUNO);
        Aula aula = criarCursoComAula("Curso com progresso");
        Matricula matricula = matricular(aluno, aula.getModulo().getCurso());
        marcarProgresso(matricula, aula);

        mockMvc.perform(delete("/api/aulas/{id}", aula.getId())
                        .header("Authorization", "Bearer " + tokenPara(admin)))
                .andExpect(status().isConflict());

        assertThat(aulaRepository.findById(aula.getId())).isPresent();
    }

    @Test
    void excluir_comPresencaRegistrada_retorna409() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin.aula.del409p@lms.com", "senha12345", Usuario.Role.ADMIN);
        Usuario aluno = criarUsuario("Aluno", "aluno.aula.del409p@lms.com", "senha12345", Usuario.Role.ALUNO);
        Aula aula = criarCursoComAula("Curso com presença");
        Matricula matricula = matricular(aluno, aula.getModulo().getCurso());
        registrarPresenca(matricula, aula);

        mockMvc.perform(delete("/api/aulas/{id}", aula.getId())
                        .header("Authorization", "Bearer " + tokenPara(admin)))
                .andExpect(status().isConflict());

        assertThat(aulaRepository.findById(aula.getId())).isPresent();
    }

    @Test
    void criar_comoAluno_retorna403() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.aula.403@lms.com", "senha12345", Usuario.Role.ALUNO);
        Modulo modulo = criarModulo("Curso aluno não pode criar aula");

        mockMvc.perform(post("/api/aulas")
                        .header("Authorization", "Bearer " + tokenPara(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CriarAulaRequest(modulo.getId(), "X", null, null, null))))
                .andExpect(status().isForbidden());
    }
}
