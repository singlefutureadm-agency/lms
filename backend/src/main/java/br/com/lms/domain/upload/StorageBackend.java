package br.com.lms.domain.upload;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * I/O cru de armazenamento: grava um {@link MultipartFile} sob uma subpasta e
 * devolve a URL pública, ou remove um arquivo a partir da URL. Validação de
 * tipo/tamanho é responsabilidade de quem chama ({@link UploadService}) — esta
 * interface só sabe gravar e apagar bytes.
 */
public interface StorageBackend {

    String salvar(MultipartFile file, String subpasta, String extensao) throws IOException;

    void deletar(String url);
}
