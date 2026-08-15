package br.com.lms.domain.notificacao;

import br.com.lms.IntegrationTestBase;
import br.com.lms.domain.curso.Curso;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.usuario.Usuario;
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

/**
 * Notificações in-app via polling. A criação em si (matricular, lançar nota)
 * já é coberta indiretamente aqui — o foco é o contrato de leitura/escrita
 * exposto por este controller, e o isolamento entre usuários.
 */
class NotificacaoControllerIT extends IntegrationTestBase {

    @Test
    void matricular_criaNotificacaoDeMatriculaConfirmada() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.notif.matricula@teste.com", "senha123", Usuario.Role.ALUNO);
        Curso curso = criarCurso("Curso Notificação Matrícula");
        String auth = "Bearer " + tokenPara(aluno);

        mockMvc.perform(post("/api/matriculas")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new MatriculaRequest(curso.getId()))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/notificacoes").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.tipo=='MATRICULA_CONFIRMADA')]").exists())
                .andExpect(jsonPath("$.content[?(@.tipo=='MATRICULA_CONFIRMADA')].lida").value(false));
    }

    @Test
    void lancarNota_criaNotificacaoDeNotaLancada() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.notif.nota@teste.com", "senha123", Usuario.Role.ALUNO);
        Usuario professor = criarUsuario("Prof", "prof.notif.nota@teste.com", "senha123", Usuario.Role.PROFESSOR);
        Curso curso = criarCurso("Curso Notificação Nota");
        Matricula matricula = matricular(aluno, curso);

        mockMvc.perform(patch("/api/matriculas/{id}/nota", matricula.getId())
                        .header("Authorization", "Bearer " + tokenPara(professor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new NotaRequest(new BigDecimal("8.0")))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/notificacoes").header("Authorization", "Bearer " + tokenPara(aluno)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.tipo=='NOTA_LANCADA')]").exists());
    }

    @Test
    void listar_soMostraNotificacoesDoProprioUsuario() throws Exception {
        Usuario alunoA = criarUsuario("Aluno A", "aluno.notif.a@teste.com", "senha123", Usuario.Role.ALUNO);
        Usuario alunoB = criarUsuario("Aluno B", "aluno.notif.b@teste.com", "senha123", Usuario.Role.ALUNO);
        criarNotificacao(alunoA, Notificacao.Tipo.MATRICULA_CONFIRMADA, "Notificação de A", false);
        criarNotificacao(alunoB, Notificacao.Tipo.MATRICULA_CONFIRMADA, "Notificação de B", false);

        mockMvc.perform(get("/api/notificacoes").header("Authorization", "Bearer " + tokenPara(alunoA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.mensagem=='Notificação de A')]").exists())
                .andExpect(jsonPath("$.content[?(@.mensagem=='Notificação de B')]").doesNotExist());
    }

    @Test
    void marcarComoLida_deNotificacaoDeOutroUsuario_retorna403() throws Exception {
        Usuario dono = criarUsuario("Dono", "aluno.notif.dono@teste.com", "senha123", Usuario.Role.ALUNO);
        Usuario intruso = criarUsuario("Intruso", "aluno.notif.intruso@teste.com", "senha123", Usuario.Role.ALUNO);
        Notificacao notificacao = criarNotificacao(dono, Notificacao.Tipo.MATRICULA_CONFIRMADA, "Só do dono", false);

        mockMvc.perform(patch("/api/notificacoes/{id}/lida", notificacao.getId())
                        .header("Authorization", "Bearer " + tokenPara(intruso)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("https://lms.local/erros/acesso-negado"));

        Notificacao inalterada = notificacaoRepository.findById(notificacao.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertFalse(inalterada.getLida());
    }

    @Test
    void marcarComoLida_peloDono_funciona() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.notif.marcar@teste.com", "senha123", Usuario.Role.ALUNO);
        Notificacao notificacao = criarNotificacao(aluno, Notificacao.Tipo.NOTA_LANCADA, "Nota lançada", false);

        mockMvc.perform(patch("/api/notificacoes/{id}/lida", notificacao.getId())
                        .header("Authorization", "Bearer " + tokenPara(aluno)))
                .andExpect(status().isNoContent());

        Notificacao atualizada = notificacaoRepository.findById(notificacao.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(atualizada.getLida());
    }

    @Test
    void contagemNaoLidas_contaApenasAsNaoLidasDoUsuario() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.notif.contagem@teste.com", "senha123", Usuario.Role.ALUNO);
        criarNotificacao(aluno, Notificacao.Tipo.MATRICULA_CONFIRMADA, "Não lida 1", false);
        criarNotificacao(aluno, Notificacao.Tipo.NOTA_LANCADA, "Não lida 2", false);
        criarNotificacao(aluno, Notificacao.Tipo.NOTA_LANCADA, "Já lida", true);

        mockMvc.perform(get("/api/notificacoes/contagem-nao-lidas")
                        .header("Authorization", "Bearer " + tokenPara(aluno)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void listar_apenasNaoLidas_filtraCorretamente() throws Exception {
        Usuario aluno = criarUsuario("Aluno", "aluno.notif.filtro@teste.com", "senha123", Usuario.Role.ALUNO);
        criarNotificacao(aluno, Notificacao.Tipo.MATRICULA_CONFIRMADA, "Pendente", false);
        criarNotificacao(aluno, Notificacao.Tipo.NOTA_LANCADA, "Lida", true);

        mockMvc.perform(get("/api/notificacoes?apenasNaoLidas=true")
                        .header("Authorization", "Bearer " + tokenPara(aluno)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].mensagem").value("Pendente"));
    }

    @Test
    void semToken_retorna401() throws Exception {
        mockMvc.perform(get("/api/notificacoes"))
                .andExpect(status().isUnauthorized());
    }
}
