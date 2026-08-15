package br.com.lms.domain.usuario;

import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Prova, sem subir um Postgres real, que o {@link DevAdminSeeder} depende
 * exclusivamente do profile ativo — nunca de um if condicional que possa falhar
 * silenciosamente.
 */
class DevAdminSeederTest {

    private final ApplicationArguments semArgumentos = new DefaultApplicationArguments();

    @Test
    void naoRegistraOBeanSobOProfileProd() {
        UsuarioRepository repositorio = mock(UsuarioRepository.class);

        contextRunner(repositorio)
                .withInitializer(ctx -> ctx.getEnvironment().addActiveProfile("prod"))
                .run(ctx -> {
                    assertThat(ctx).doesNotHaveBean(DevAdminSeeder.class);
                    verifyNoInteractions(repositorio);
                });
    }

    @Test
    void registraECriaOAdminSobOProfileDevQuandoAindaNaoExiste() {
        UsuarioRepository repositorio = mock(UsuarioRepository.class);
        when(repositorio.existsByEmail(anyString())).thenReturn(false);

        contextRunner(repositorio)
                .withInitializer(ctx -> ctx.getEnvironment().addActiveProfile("dev"))
                .run(ctx -> {
                    assertThat(ctx).hasSingleBean(DevAdminSeeder.class);
                    ctx.getBean(DevAdminSeeder.class).run(semArgumentos);
                    verify(repositorio).save(any(Usuario.class));
                });
    }

    @Test
    void naoDuplicaOAdminSobOProfileDevQuandoJaExiste() {
        UsuarioRepository repositorio = mock(UsuarioRepository.class);
        when(repositorio.existsByEmail(anyString())).thenReturn(true);

        contextRunner(repositorio)
                .withInitializer(ctx -> ctx.getEnvironment().addActiveProfile("dev"))
                .run(ctx -> {
                    ctx.getBean(DevAdminSeeder.class).run(semArgumentos);
                    verify(repositorio, org.mockito.Mockito.never()).save(any());
                });
    }

    private ApplicationContextRunner contextRunner(UsuarioRepository repositorio) {
        return new ApplicationContextRunner()
                .withUserConfiguration(DevAdminSeeder.class)
                .withBean(UsuarioRepository.class, () -> repositorio)
                .withBean(PasswordEncoder.class, BCryptPasswordEncoder::new)
                .withPropertyValues("app.dev-admin.senha=irrelevante-para-o-teste");
    }
}
