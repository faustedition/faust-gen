package net.faustedition.gen;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Stream;
import java.util.stream.Stream.Builder;

import javax.xml.stream.XMLStreamException;
import javax.xml.transform.TransformerException;

import com.mycila.xmltool.XMLDoc;
import com.mycila.xmltool.XMLDocumentException;
import com.mycila.xmltool.XMLTag;

import de.faustedition.transcript.simple.SimpleTransform;

public class DiplomaticConversion {

	private static Logger logger = Logger.getLogger(DiplomaticConversion.class.getName());

	public static Path root = Paths.get("/home/tv/Faust/");
	public static Path target = Paths.get("target");

	public static Stream<URI> findTranscript(final Path path) {
		try {
			final XMLTag doc = XMLDoc.from(path.toFile()).deletePrefixes();
			final URI base = URI.create(doc.gotoTag("//*[@base]").getAttribute("base"));
			final Builder<URI> builder = Stream.builder();
			doc.forEach(tag -> builder.accept(base.resolve(tag.getAttribute("uri"))), "//docTranscript[@uri]");
			return builder.build();
		} catch (final XMLDocumentException e) {
			logger.log(Level.WARNING, path + ": XML extraction error", e);
			return Stream.empty();
		}
	}

	public static void main(final String[] args) throws IOException {
		logger.info(System.getProperties().toString());
		getDiplomaticTranscripts()
			.forEach(DiplomaticConversion::writeTranscriptJson);
	}

	public static URI writeTranscriptJson(final URI faustURI) {
		final Path sourcePath = resolveFaustUri(faustURI);
		final Path targetPath = getJsonPath(faustURI);
		targetPath.getParent().toFile().mkdirs();
		try (FileInputStream input = new FileInputStream(sourcePath.toFile())) {
			final StringWriter output = new StringWriter();
			SimpleTransform.simpleTransform(input, output);
			com.google.common.io.Files.write(output.toString(), targetPath.toFile(), Charset.forName("UTF-8"));
		} catch (IOException | TransformerException | XMLStreamException e) {
			logger.log(Level.SEVERE, "Failed to generate JSON for " + faustURI.toString(), e);
		}
		return faustURI;
	}

	private static Path getJsonPath(final URI faustURI) {
		return target.resolve(faustURI.getPath().substring(1).concat(".json"));
	}

	public static Path resolveFaustUri(final URI uri) {
		return root.resolve(uri.getPath().substring(1));
	}

	private static Stream<URI> getDiplomaticTranscripts() throws IOException {
		return Files.walk(root.resolve("document")).filter(path -> path.toString().endsWith(".xml")).flatMap(
				DiplomaticConversion::findTranscript);
	}
}
