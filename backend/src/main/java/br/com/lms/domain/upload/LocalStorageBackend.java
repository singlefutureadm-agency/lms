package br.com.lms.domain.upload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * Grava/apaga arquivos no disco local, sob {@code app.upload.dir}. Backend
 * padrão — ativo a menos que {@code app.storage.provider} aponte para outra
 * coisa (ex.: um backend em nuvem no futuro).
 */
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalStorageBackend implements StorageBackend {

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${app.upload.base-url}")
    private String baseUrl;

    @Override
    public String salvar(MultipartFile file, String subpasta, String extensao) throws IOException {
        String nomeArquivo = UUID.randomUUID() + "." + extensao;

        Path diretorio = Paths.get(uploadDir, subpasta);
        Files.createDirectories(diretorio);

        Path destino = diretorio.resolve(nomeArquivo);
        Files.copy(file.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);

        return baseUrl + "/uploads/" + subpasta + "/" + nomeArquivo;
    }

    @Override
    public void deletar(String urlAtual) {
        if (urlAtual == null || urlAtual.isBlank()) return;
        try {
            // Extrai o caminho relativo após /uploads/
            int idx = urlAtual.indexOf("/uploads/");
            if (idx < 0) return;
            String relativo = urlAtual.substring(idx + "/uploads/".length());
            Path arquivo = Paths.get(uploadDir, relativo.split("/"));
            Files.deleteIfExists(arquivo);
        } catch (IOException ignored) {}
    }
}
