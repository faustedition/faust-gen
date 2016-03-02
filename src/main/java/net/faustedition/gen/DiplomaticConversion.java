package net.faustedition.gen;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.net.URI;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Optional;
import java.util.PrimitiveIterator.OfInt;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import java.util.stream.Stream.Builder;

import javax.xml.stream.XMLStreamException;
import javax.xml.transform.TransformerException;

import com.google.common.base.Joiner;
import com.google.common.collect.Lists;
import com.mycila.xmltool.XMLDoc;
import com.mycila.xmltool.XMLDocumentException;
import com.mycila.xmltool.XMLTag;

import de.faustedition.transcript.simple.SimpleTransform;
import fi.iki.elonen.SimpleWebServer;

public class DiplomaticConversion {

	private static Logger logger = Logger.getLogger(DiplomaticConversion.class.getName());

	public static Path root = Paths.get("data/xml/");
	public static Path target = Paths.get("target");
	private static String serverURL;

	public static class TranscriptPage {
		public final Document document;
		private final String page;
		private final int pageNo;

		public TranscriptPage(final Document document, final String page, final int pageNo) {
			this.document = document;
			this.page = page;
			this.pageNo = pageNo;
		}

		public Path source() {
			return resolveFaustUri(document.base.resolve(page));
		}

		private Path getPagePath(final String extension) {
			final Path relPath = document.relPath;
			return Paths.get(relPath.subpath(1, relPath.getNameCount()).toString(),
					MessageFormat.format("page_{0}.{1}", pageNo, extension));
		}

		public TranscriptPage writeTranscriptJson() {
			final Path targetPath = getJsonPath();
			targetPath.getParent().toFile().mkdirs();
			try (FileInputStream input = new FileInputStream(source().toFile())) {
				final StringWriter output = new StringWriter();
				SimpleTransform.simpleTransform(input, output);
				com.google.common.io.Files.write(output.toString(), targetPath.toFile(), Charset.forName("UTF-8"));
			} catch (IOException | TransformerException | XMLStreamException e) {
				logger.log(Level.SEVERE, "Failed to generate JSON for " + document.base.resolve(page), e);
			}
			return this;
		}

		public Optional<Path> getImageLinkPath() {
			try {
				final XMLTag transcript = XMLDoc.from(source().toFile()).deletePrefixes();
				final XMLTag graphic = transcript.gotoTag("//graphic[@mimeType = 'image/svg+xml']");
				return Optional.of(resolveFaustUri(URI.create(graphic.getAttribute("url"))));
			} catch (final XMLDocumentException e) {
				return Optional.empty();
			}
		}

		@Override
		public String toString() {
			return MessageFormat.format("{0} page {1}: {2}", document.faustURI, pageNo, document.base.resolve(page));
		}

		public boolean buildSVGs() {
			logger.fine("Converting " + this);
			final ArrayList<String> arguments = Lists.newArrayList(
					System.getProperty("phantomjs.binary", "/usr/local/bin/phantomjs"), "rendersvgs.js",
					serverURL, getJsonPath().toString(),
					target.resolve("transcripts").resolve("diplomatic").resolve(getPagePath("svg")).toString());
			final Optional<Path> imageLinkPath = getImageLinkPath();
			if (imageLinkPath.isPresent()) {
				arguments.add(imageLinkPath.get().toString());
				arguments.add(target.resolve("transcripts").resolve("overlay").resolve(getPagePath("svg")).toString());
			} else {
				logger.fine(this + " has no text-image-links");
			}

			try {
				final Process renderProcess = new ProcessBuilder(arguments).redirectErrorStream(true).start();
				final BufferedReader bufferedReader = new BufferedReader(
						new InputStreamReader(new BufferedInputStream(renderProcess.getInputStream())));
				bufferedReader.lines().forEach(line -> logger.warning(line + " (while converting " + this + ")"));
				return renderProcess.waitFor() != 0;
			} catch (IOException | InterruptedException e) {
				logger.log(Level.SEVERE, "Failed to convert SVG for " + document.base.resolve(page), e);
			}
			return true;
		}

		private Path getJsonPath() {
			return target.resolve("pages/").resolve(getPagePath("json"));
		}
	}

	public static class Document {

		private final Path path;
		/** The base faust:// uri for the transcripts of this document */
		public URI base;
		/** The relative path to this document */
		public final Path relPath;
		/** The faust:// uri for this document */
		public URI faustURI;

		public Document(final Path path) {
			this.path = path;
			relPath = root.relativize(path);
			faustURI = URI.create("faust://xml/" + relPath.toString());
		}

		public Stream<TranscriptPage> transcripts() {
			try {
				final XMLTag doc = XMLDoc.from(path.toFile()).deletePrefixes();
				base = URI.create(doc.gotoTag("//*[@base]").getAttribute("base"));
				final Builder<TranscriptPage> builder = Stream.builder();
				final OfInt pageNumbers = IntStream.iterate(1, i -> i + 1).sequential().iterator();
				doc.forEach(tag -> builder.accept(new TranscriptPage(this, tag.getAttribute("uri"), pageNumbers.nextInt())),
						"//docTranscript[@uri]");
				return builder.build();
			} catch (final XMLDocumentException e) {
				logger.log(Level.WARNING, path + ": XML extraction error", e);
				return Stream.empty();
			}
		}
	}

	public static void main(final String[] args) throws IOException {
		logger.info(Joiner.on("\n").withKeyValueSeparator(": ").join(System.getProperties()));
		
		final SimpleWebServer webServer = new SimpleWebServer("localhost", 0, new File("svg_rendering/page"), true);
		webServer.start(60, true);
		try {
			serverURL = new URL("http", "localhost", webServer.getListeningPort(), "/transcript-generation.html").toString();
			logger.info(MessageFormat.format("Web server runs on {0}", serverURL));
		
		

		final Object[] failedConversions = getDocuments()
				.flatMap(document -> document.transcripts())
				.parallel()
				.map(page -> page.writeTranscriptJson())
				.filter(page -> page.buildSVGs())
				.filter(page -> page.buildSVGs())
				.filter(page -> page.buildSVGs())
				.toArray();

		if (failedConversions.length > 0) {
			logger.log(Level.SEVERE, MessageFormat.format("Conversion of the following {0} pages failed:\n {1}",
					failedConversions.length, Joiner.on("\n ").join(failedConversions)));
			System.exit(1);
		}
		} finally {
			webServer.stop();
		}
		
	}

	public static Path resolveFaustUri(final URI uri) {
		return root.resolve(uri.getPath().substring(1));
	}

	private static Stream<Document> getDocuments() throws IOException {
		return Files.walk(root.resolve("document")).filter(path -> path.toString().endsWith(".xml")).map(
				path -> new Document(path));
	}
}
