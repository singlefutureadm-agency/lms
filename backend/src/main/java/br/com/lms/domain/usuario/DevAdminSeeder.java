package br.com.lms.domain.usuario;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Cria, na subida da aplicação, um usuário ADMIN de conveniência para teste manual
 * em ambiente local (ex.: miguel@lms.com).
 *
 * <p>Só existe sob o profile "dev" — a anotação {@link Profile} impede o bean de
 * sequer ser registrado sob qualquer outro profile, então não há como este código
 * rodar em produção por falha de configuração (não depende de um if condicional
 * que possa ser esquecido ou avaliado errado; a ausência do profile já basta).
 * Ver DevAdminSeederTest para a prova disso.
 *
 * <p>Diferente do fluxo público de registro, cria o usuário direto com role ADMIN.
 */
@Component
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DevAdminSeeder implements ApplicationRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Override
    public void run(ApplicationArguments args) {
        String email = environment.getProperty("app.dev-admin.email", "miguel@lms.com");
        if (usuarioRepository.existsByEmail(email)) return;

        String nome = environment.getProperty("app.dev-admin.nome", "Miguel (dev)");
        String senha = environment.getProperty("app.dev-admin.senha", "dev_only_troque_local_123");

        Usuario admin = Usuario.builder()
                .nome(nome)
                .email(email)
                .senha(passwordEncoder.encode(senha))
                .role(Usuario.Role.ADMIN)
                .build();
        usuarioRepository.save(admin);

        log.warn("[DEV] Usuário admin de desenvolvimento criado automaticamente: email={}. " +
                "Uso exclusivo de ambiente local para teste manual — este usuário NÃO deve existir em produção.",
                email);
    }
}
