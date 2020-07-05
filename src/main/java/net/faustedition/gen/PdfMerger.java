package net.faustedition.gen;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

public class PdfMerger {

    public static void main(String[] argv) {
        final PdfWriter writer;
        try {
            writer = new PdfWriter("/tmp/out.pdf");
            writer.setSmartMode(true);
            final PdfDocument pdfDocument = new PdfDocument(writer);
            pdfDocument.initializeOutlines();
            Path root = Paths.get("/home/tv/git/faust-gen/target/www/transcript/diplomatic/2_H");

            for (int i = 1; i < 390; i++) {
                PdfDocument addedDoc = new PdfDocument(new PdfReader(root.resolve(String.format("page_%d.pdf", i)).toString()));
                addedDoc.copyPagesTo(1, addedDoc.getNumberOfPages(), pdfDocument);
                addedDoc.close();
            }
            pdfDocument.close();
        } catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
