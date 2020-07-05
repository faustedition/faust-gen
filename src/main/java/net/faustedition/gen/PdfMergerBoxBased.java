package net.faustedition.gen;

import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

public class PdfMergerBoxBased {


    public static void main(String[] argv) {
        final PDFMergerUtility merger = new PDFMergerUtility();
        merger.setDestinationFileName("/tmp/2_H_box.pdf");
        final Path root = Paths.get("/home/tv/git/faust-gen/target/www/transcript/diplomatic/2_H");
        for (int i = 1; i < 390; i++) {
            try {
                merger.addSource(root.resolve(String.format("page_%d.pdf", i)).toFile());
            } catch (FileNotFoundException e) {
                System.err.println("file not found" + e.getMessage());
            }
        }
        try {
            merger.mergeDocuments(MemoryUsageSetting.setupMainMemoryOnly());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

}
