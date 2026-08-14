package br.com.lms.domain.curso;

import br.com.lms.IntegrationTestBase;
import br.com.lms.domain.area.Area;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.CursoRequest;
import br.com.lms.dto.DTOs.ModuloRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CursoControllerIT extends IntegrationTestBase {

    @Test
    void criarCurso_comModulosAninhados_retornaCriado() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin@teste.com", "senha123", Usuario.Role.ADMIN);
        Area area = areaRepository.findAll().get(0);
        CursoRequest request = new CursoRequest(
                "Curso Com Módulos", "desc", Curso.Nivel.BASICO, null, area.getId(),
                List.of(new ModuloRequest(null, "Módulo 1", 1, null), new ModuloRequest(null, "Módulo 2", 2, null)),
                null, null);

        String resposta = mockMvc.perform(post("/api/cursos")
                        .header("Authorization", "Bearer " + tokenPara(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.titulo").value("Curso Com Módulos"))
                .andReturn().getResponse().getContentAsString();

        long cursoId = objectMapper.readTree(resposta).get("id").asLong();
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        assertEquals(2, curso.getModulos().size());
    }

    @Test
    void atualizarCurso_comModulosSemId_removeAntigosECriaNovos() throws Exception {
        // Módulos enviados sem id são tratados como novos: o merge incremental cria
        // os do payload e remove os antigos que não foram referenciados por id. Como
        // nenhum módulo aqui carrega id, o resultado observável coincide com o do
        // replace-all antigo — a diferença aparece quando o id é enviado (ver os
        // testes abaixo, que preservam módulo/aula/progresso existentes).
        Usuario admin = criarUsuario("Admin", "admin2@teste.com", "senha123", Usuario.Role.ADMIN);
        Area area = areaRepository.findAll().get(0);
        CursoRequest criar = new CursoRequest(
                "Curso Original", "desc", Curso.Nivel.BASICO, null, area.getId(),
                List.of(new ModuloRequest(null, "Módulo Original", 1, null)), null, null);

        String resposta = mockMvc.perform(post("/api/cursos")
                        .header("Authorization", "Bearer " + tokenPara(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(criar)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long cursoId = objectMapper.readTree(resposta).get("id").asLong();

        CursoRequest atualizar = new CursoRequest(
                "Curso Original", "desc", Curso.Nivel.BASICO, null, area.getId(),
                List.of(new ModuloRequest(null, "Módulo Novo A", 1, null), new ModuloRequest(null, "Módulo Novo B", 2, null)),
                null, null);

        mockMvc.perform(put("/api/cursos/{id}", cursoId)
                        .header("Authorization", "Bearer " + tokenPara(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(atualizar)))
                .andExpect(status().isOk());

        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        assertEquals(2, curso.getModulos().size());
        assertTrue(curso.getModulos().stream().noneMatch(m -> m.getTitulo().equals("Módulo Original")));
        assertTrue(curso.getModulos().stream().anyMatch(m -> m.getTitulo().equals("Módulo Novo A")));
    }

    @Test
    void atualizarCurso_moduloComIdExistente_preservaAulasEProgressoDoAluno() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin3@teste.com", "senha123", Usuario.Role.ADMIN);
        Usuario aluno = criarUsuario("Aluno", "aluno3@teste.com", "senha123", Usuario.Role.ALUNO);
        Aula aula = criarCursoComAula("Curso Com Progresso");
        Modulo moduloComAula = aula.getModulo();
        Curso curso = moduloComAula.getCurso();

        Matricula matricula = matricular(aluno, curso);
        var progresso = marcarProgresso(matricula, aula);

        // completa o curso com mais 9 módulos, para reproduzir o cenário de 10 módulos
        // onde só o módulo com a aula com progresso é "editado" (troca de título)
        List<Modulo> extras = new ArrayList<>();
        for (int i = 2; i <= 10; i++) {
            extras.add(Modulo.builder().titulo("Módulo " + i).ordem(i).curso(curso).build());
        }
        curso.getModulos().addAll(extras);
        cursoRepository.save(curso);
        entityManager.flush();
        entityManager.clear();

        Curso cursoRecarregado = cursoRepository.findById(curso.getId()).orElseThrow();
        List<ModuloRequest> modulosRequest = cursoRecarregado.getModulos().stream()
                .map(m -> new ModuloRequest(m.getId(),
                        m.getId().equals(moduloComAula.getId()) ? "Módulo 1 - Editado" : m.getTitulo(),
                        m.getOrdem(), m.getUrlVideo()))
                .toList();
        CursoRequest atualizar = new CursoRequest(
                cursoRecarregado.getTitulo(), cursoRecarregado.getDescricao(), cursoRecarregado.getNivel(),
                null, cursoRecarregado.getArea().getId(), modulosRequest, null, null);

        mockMvc.perform(put("/api/cursos/{id}", curso.getId())
                        .header("Authorization", "Bearer " + tokenPara(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(atualizar)))
                .andExpect(status().isOk());

        assertTrue(progressoAulaRepository.findById(progresso.getId()).isPresent(),
                "progresso_aulas da matrícula existente não deveria ser apagado pela edição do curso");

        Curso cursoAtualizado = cursoRepository.findById(curso.getId()).orElseThrow();
        assertEquals(10, cursoAtualizado.getModulos().size());
        Modulo moduloAtualizado = cursoAtualizado.getModulos().stream()
                .filter(m -> m.getId().equals(moduloComAula.getId()))
                .findFirst().orElseThrow();
        assertEquals("Módulo 1 - Editado", moduloAtualizado.getTitulo());
        assertEquals(1, moduloAtualizado.getAulas().size());
        assertEquals(aula.getId(), moduloAtualizado.getAulas().get(0).getId());
    }

    @Test
    void atualizarCurso_removendoModuloComProgressoAssociado_retorna409SemApagarNada() throws Exception {
        Usuario admin = criarUsuario("Admin", "admin4@teste.com", "senha123", Usuario.Role.ADMIN);
        Usuario aluno = criarUsuario("Aluno", "aluno4@teste.com", "senha123", Usuario.Role.ALUNO);
        Aula aula = criarCursoComAula("Curso Bloqueia Remocao");
        Curso curso = aula.getModulo().getCurso();
        Matricula matricula = matricular(aluno, curso);
        marcarProgresso(matricula, aula);

        // payload sem nenhum módulo: tentaria remover o único módulo, que tem aula com progresso
        CursoRequest atualizar = new CursoRequest(
                curso.getTitulo(), curso.getDescricao(), curso.getNivel(), null, curso.getArea().getId(),
                List.of(), null, null);

        mockMvc.perform(put("/api/cursos/{id}", curso.getId())
                        .header("Authorization", "Bearer " + tokenPara(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(atualizar)))
                .andExpect(status().isConflict());

        Curso cursoInalterado = cursoRepository.findById(curso.getId()).orElseThrow();
        assertEquals(1, cursoInalterado.getModulos().size());
    }

    @Test
    void criarCurso_comoAluno_retorna403() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno@teste.com", "senha123", Usuario.Role.ALUNO);
        Area area = areaRepository.findAll().get(0);
        CursoRequest request = new CursoRequest(
                "Curso Proibido", "desc", Curso.Nivel.BASICO, null, area.getId(), null, null, null);

        mockMvc.perform(post("/api/cursos")
                        .header("Authorization", "Bearer " + tokenPara(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }
}
