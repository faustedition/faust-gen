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
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.Stream.Builder;

import javax.xml.stream.XMLStreamException;
import javax.xml.transform.TransformerException;

import com.google.common.base.Joiner;
import com.google.common.collect.ImmutableList;
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

	private static boolean debugPhantomJS;

	private static boolean onlyWebServer;

	private static ImmutableList<String> baseCmdLine;

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
			final Path resolvedSvgPath = target.resolve("www").resolve("transcript").resolve("diplomatic").resolve(getPagePath("svg"));
			resolvedSvgPath.getParent().toFile().mkdirs();
			final ArrayList<String> arguments = Lists.newArrayList(
					System.getProperty("phantomjs.binary", "/usr/local/bin/phantomjs"), 
					"rendersvgs.js",
					serverURL, 
					getJsonPath().toString(),
					resolvedSvgPath.toString());
			if (debugPhantomJS)
				arguments.add(1, "--debug=errors");
			
			final Optional<Path> imageLinkPath = getImageLinkPath();
			if (imageLinkPath.isPresent()) {
				arguments.add(imageLinkPath.get().toString());
				Path resolvedOverlayPath = target.resolve("www").resolve("transcript").resolve("overlay").resolve(getPagePath("svg"));
				resolvedOverlayPath.getParent().toFile().mkdirs();
				arguments.add(resolvedOverlayPath.toString());
			} else {
				logger.fine(this + " has no text-image-links");
			}

			try {
				logger.fine(() -> String.join(" ", arguments));
				final Process renderProcess = new ProcessBuilder(arguments).redirectErrorStream(true).start();
				final BufferedReader bufferedReader = new BufferedReader(
						new InputStreamReader(new BufferedInputStream(renderProcess.getInputStream())));
				String scriptOutput = bufferedReader.lines().distinct().collect(Collectors.joining("\n"));
				int exitCode = renderProcess.waitFor();
				if (exitCode != 0) {
					logger.log(Level.SEVERE, MessageFormat.format("Failed to convert SVG for {0}: Exit Code {1}. Script output:\n{2}", document.base.resolve(page), exitCode, scriptOutput));
				} else if (!debugPhantomJS && scriptOutput.length() > 2) {
					logger.log(Level.WARNING, MessageFormat.format("Conversion to SVG for {0} issued messages:\n{1}", document.base.resolve(page), scriptOutput));
				}
				return exitCode != 0;
			} catch (IOException | InterruptedException e) {
				logger.log(Level.SEVERE, "Failed to convert SVG for " + document.base.resolve(page) + ": " + e.getMessage(), e);
			}
			return true;
		}

		public Callable<Optional<TranscriptPage>> getSvgBuilder() {
			return () -> (this.buildSVGs() ? Optional.of(this) : Optional.empty());
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
				doc.forEach(tag -> builder.accept(new TranscriptPage(this, tag.getAttribute("uri"), tag.rawXpathNumber("count(preceding::page)").intValue()+1)),
						"//docTranscript[@uri]");
				return builder.build();
			} catch (final XMLDocumentException e) {
				logger.log(Level.WARNING, path + ": XML extraction error", e);
				return Stream.empty();
			}
		}
	}

	public static void main(final String[] args) throws IOException {
		Properties properties = System.getProperties();
		System.setProperty("java.util.logging.SimpleFormatter.format", "%4$s: %5$s%n");
		onlyWebServer = Boolean.valueOf((String) properties.getOrDefault("faust.diplo.server", "false"));
		debugPhantomJS = Boolean.valueOf((String) properties.getOrDefault("faust.diplo.debug", "false"));
		final SimpleWebServer webServer = new SimpleWebServer("localhost", 0, new File("svg_rendering/page"), true);
		webServer.start(60, true);
		try {
			serverURL = new URL("http", "localhost", webServer.getListeningPort(), "/transcript-generation.html").toString();
			logger.info(MessageFormat.format("Web server runs on {0}", serverURL));
			baseCmdLine = ImmutableList.of(
					System.getProperty("phantomjs.binary", "/usr/local/bin/phantomjs"), 
					debugPhantomJS? "--debug=true" : "",
					"rendersvgs.js",
					serverURL);
			logger.info(() -> "PhantomJS command line: " + String.join(" ", baseCmdLine) + " <input> <output> [<links> <linkoutput>]");
			
		
			if (onlyWebServer) {
				logger.info("Hit Ctrl+C to interrupt");
				while (true)
					Thread.sleep(60000);
			} else {
				
				logger.info("Converting diplomatic transcripts to JSON ...");

				List<TranscriptPage> transcriptPages = getDocuments()
						.flatMap(document -> document.transcripts())
						.parallel()
						.map(page -> page.writeTranscriptJson())
						.collect(Collectors.toList());
				 
				 
				int nThreads = Integer.valueOf(System.getProperty("faust.diplo.threads", "0"));
				if (nThreads <= 0)
					nThreads = Runtime.getRuntime().availableProcessors();
				
				int tries = 0;
				int totalPages;
				int failedPages;
				List<TranscriptPage> failedConversions;
				do {
					failedConversions = runSVGconversion(transcriptPages, nThreads);
					totalPages = transcriptPages.size();
					failedPages = failedConversions.size();
					tries += 1;
					if (failedPages > 0 && failedPages < totalPages && tries > 1) {
						transcriptPages.removeAll(failedConversions);
						logger.log(Level.WARNING, MessageFormat.format("The following {0} pages needed {1} tries to properly convert:\n {2}", 
								totalPages - failedPages, tries, Joiner.on("\n ").join(transcriptPages)));
					} else {
						logger.log(Level.INFO, MessageFormat.format("Failed to convert {0} of {1} pages at try {2}", failedPages, totalPages, try);
					}
					transcriptPages = failedConversions;
				} while (failedPages > 0 && failedPages < totalPages);
				

				if (!failedConversions.isEmpty()) {
					logger.log(Level.SEVERE, MessageFormat.format("Conversion of the following {0} pages failed after {1} tries:\n {2}",
							failedConversions.size(), tries, Joiner.on("\n ").join(failedConversions)));
					int allowedFailures = Integer.parseUnsignedInt(System.getProperty("faust.diplo.allowedFailures", "0"));
					if (failedConversions.size() > allowedFailures) {
						logger.log(Level.SEVERE, MessageFormat.format("These are more than the {0} tolerated failures.", allowedFailures));
						System.exit(1);
					} else {
						logger.log(Level.INFO, MessageFormat.format("Up to {0} failures are tolerated.", allowedFailures));
					}
				}
			}
		} catch (InterruptedException e) {
			logger.log(Level.INFO, "Interrupted.", e);
		} finally {
			webServer.stop();
		}
		
	}

	/**
	 * Runs the conversion for the given pages in nThreads parallel jobs.  
	 * 
	 * @param pages pages to convert. JSON files must already exist.
	 * @param nThreads Number of threads to use.
	 * @return List of pages for which conversion failed.
	 * @throws InterruptedException
	 */
	private static List<TranscriptPage> runSVGconversion(List<TranscriptPage> pages, int nThreads)
			throws InterruptedException {

		logger.log(Level.INFO, MessageFormat.format("Rendering {0} pages in {1} parallel jobs ...", pages.size(), nThreads));
		
		List<Callable<Optional<TranscriptPage>>> svgBuilders =	Lists.transform(pages, page -> page.getSvgBuilder());
		ExecutorService threadPool = Executors.newFixedThreadPool(nThreads);
		List<Future<Optional<TranscriptPage>>> results = threadPool.invokeAll(svgBuilders);
		
		List<TranscriptPage> failedConversions = results.stream()
				.map(future -> {
					try {
						return future.get();
					} catch (InterruptedException | ExecutionException e) {
						logger.log(Level.SEVERE, "Failed to get conversion future!?", e);
						return Optional.<TranscriptPage>empty();
					}
				})
				.filter(result -> result.isPresent())
				.map(result -> result.get())
				.collect(Collectors.toList());
		threadPool.shutdown();
		logger.log(Level.INFO, MessageFormat.format("... rendering failed for {0} pages:\n\t{1}", Joiner.on("\n\t").join(failedConversions)));
		return failedConversions;
	}

	public static Path resolveFaustUri(final URI uri) {
		return root.resolve(uri.getPath().substring(1));
	}

	private static Stream<Document> getDocuments() throws IOException {
		return Files.walk(root.resolve("document")).filter(path -> path.toString().endsWith(".xml")).map(
				path -> new Document(path));
	}
}
