package br.com.lms.config;

import br.com.lms.security.JwtAuthFilter;
import br.com.lms.security.UserDetailsServiceImpl;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;
    private final Environment environment;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        boolean swaggerPublico = !environment.matchesProfiles("prod");
        return http
            .csrf(CsrfConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfig()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint(authenticationEntryPoint()))
            .authorizeHttpRequests(auth -> auth
                // Auth — público
                .requestMatchers("/api/auth/**").permitAll()
                // Health check — público.
                // Os demais endpoints do actuator seguem exigindo autenticação
                // (só health e info estão expostos, ver application.properties).
                .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                // Swagger/OpenAPI — público em dev; em prod exige ADMIN autenticado,
                // pra não expor o mapa completo de endpoints sem autenticação nenhuma.
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .access((authentication, context) -> new AuthorizationDecision(
                            swaggerPublico || context.getRequest().isUserInRole("ADMIN")))
                // Arquivos de upload — leitura pública
                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                // Endpoints de upload — requerem autenticação (roles verificados via @PreAuthorize)
                .requestMatchers("/api/upload/**").authenticated()
                // Cursos — leitura pública, escrita ADMIN
                .requestMatchers(HttpMethod.GET, "/api/cursos", "/api/cursos/{id}").permitAll()
                // Unidades — leitura pública
                .requestMatchers(HttpMethod.GET, "/api/unidades/**").permitAll()
                // Áreas, Categorias e Tipos — totalmente públicos
                .requestMatchers(HttpMethod.GET, "/api/areas/**", "/api/tipos/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/cursos").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/cursos/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/cursos/**").hasRole("ADMIN")
                // Usuários
                .requestMatchers(HttpMethod.GET, "/api/usuarios").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/usuarios/**").hasRole("ADMIN")
                // Regiões e Unidades — lista e todas-unidades são públicas, detalhes exigem auth
                .requestMatchers(HttpMethod.GET, "/api/regioes", "/api/regioes/unidades").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/regioes/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/regioes", "/api/regioes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/regioes/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/regioes/**").hasRole("ADMIN")
                // Professores
                .requestMatchers("/api/professores/meus-cursos").hasAnyRole("ADMIN", "PROFESSOR")
                .requestMatchers(HttpMethod.GET, "/api/professores/**").hasAnyRole("ADMIN", "PROFESSOR")
                .requestMatchers(HttpMethod.POST, "/api/professores/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/professores/**").hasRole("ADMIN")
                // Conteúdo das aulas
                .requestMatchers(HttpMethod.GET, "/api/aulas/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/aulas/**").hasAnyRole("ADMIN", "PROFESSOR")
                .requestMatchers(HttpMethod.PUT, "/api/aulas/**").hasAnyRole("ADMIN", "PROFESSOR")
                .requestMatchers(HttpMethod.DELETE, "/api/aulas/**").hasAnyRole("ADMIN", "PROFESSOR")
                // Presença
                .requestMatchers(HttpMethod.POST, "/api/presenca").hasAnyRole("ADMIN", "PROFESSOR")
                .requestMatchers(HttpMethod.GET, "/api/presenca/**").authenticated()
                // Matrículas — listagem por curso para admin/professor
                .requestMatchers(HttpMethod.GET, "/api/matriculas/curso/**").hasAnyRole("ADMIN", "PROFESSOR")
                // Nota
                .requestMatchers(HttpMethod.PATCH, "/api/matriculas/*/nota").hasAnyRole("ADMIN", "PROFESSOR")
                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    /**
     * Spring Security 7 removeu o construtor sem-argumentos e o
     * {@code setUserDetailsService} — o UserDetailsService agora é obrigatório
     * na construção.
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /**
     * {@code AuthenticationConfiguration} está deprecated-for-removal no Security 7.
     * Como só existe um provider, montamos o ProviderManager diretamente.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationProvider authenticationProvider) {
        return new ProviderManager(authenticationProvider);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Erros de autenticação acontecem dentro da cadeia de filtros, antes do
     * {@code @RestControllerAdvice}, então este ponto precisa emitir o formato
     * RFC 7807 por conta própria — senão a API teria um contrato de erro para o
     * filtro e outro para os controllers, que era exatamente o caso antes.
     */
    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("""
                {"type":"https://lms.local/erros/nao-autenticado",\
                "title":"Não autenticado",\
                "status":401,\
                "detail":"Autenticação necessária",\
                "instance":"%s"}""".formatted(request.getRequestURI()));
        };
    }

    @Bean
    public CorsConfigurationSource corsConfig() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:4200", "http://localhost:4300"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
