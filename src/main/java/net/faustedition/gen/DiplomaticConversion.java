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
import javax.xml.transform.stream.StreamSource;

import com.google.common.base.Joiner;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Lists;
import com.mycila.xmltool.XMLDoc;
import com.mycila.xmltool.XMLDocumentException;
import com.mycila.xmltool.XMLTag;

import de.faustedition.transcript.simple.SimpleTransform;
import fi.iki.elonen.SimpleWebServer;
import net.sf.saxon.s9api.Processor;
import net.sf.saxon.s9api.QName;
import net.sf.saxon.s9api.SaxonApiException;
import net.sf.saxon.s9api.XdmAtomicValue;
import net.sf.saxon.s9api.XsltExecutable;
import net.sf.saxon.s9api.XsltTransformer;
import org.codehaus.jackson.map.ObjectMapper;

public class DiplomaticConversion {


	private static final String PROPERTY = System.getProperty("faust.diplo.documentroot", "document");

	private static final File renderWebapp = new File(System.getProperty("faust.diplo.webapp", "svg_rendering/page"));
	private static final URI cssURI = Paths.get(System.getProperty("faust.diplo.css", new File(renderWebapp, "css/document-transcript.css").toString())).toAbsolutePath().toUri();

	private static Logger logger = Logger.getLogger(DiplomaticConversion.class.getName());

	public static Path root = Paths.get(System.getProperty("faust.diplo.root", "data/xml/"));
	public static Path target = Paths.get("target");

	private static final Path prepared_svg = target.resolve(System.getProperty("faust.diplo.prepared-svg", "prepared-svg"));
	public static Path profile = target.resolve("profile");
	public static final Path wwwout_path = target.resolve(System.getProperty("faust.diplo.transcript_www", "www"));
	public static final Path diplomatic_path = wwwout_path.resolve("transcript").resolve("diplomatic");
	private static String serverURL;

	private static boolean debugPhantomJS;

	private static boolean onlyWebServer;

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
			return getNewPagePath(extension);
			/*
			final Path relPath = document.relPath;
			return Paths.get(relPath.subpath(1, relPath.getNameCount()).toString(),
					MessageFormat.format("page_{0}.{1}", pageNo, extension)); */
		}
		
		private Path getNewPagePath(final String extension) {
			return Paths.get(document.basename, MessageFormat.format("page_{0}.{1}", pageNo, extension));
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
			return MessageFormat.format("{0} page {1}: {2}", document.sigil, pageNo, document.base.resolve(page));
		}

		public boolean buildSVGs() {
			logger.fine("Converting " + this);
			final Path resolvedSvgPath = diplomatic_path.resolve(getPagePath("svg"));
			resolvedSvgPath.getParent().toFile().mkdirs();
            final ArrayList<String> arguments = getRenderCommandLine();

            arguments.add(getJsonPath().toString());
			arguments.add(resolvedSvgPath.toString());

			final Optional<Path> imageLinkPath = getImageLinkPath();
			if (imageLinkPath.isPresent()) {
				arguments.add(imageLinkPath.get().toString());
				Path resolvedOverlayPath = wwwout_path.resolve("transcript").resolve("overlay").resolve(getPagePath("svg"));
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
					logger.log(Level.SEVERE, MessageFormat.format("Failed to convert SVG for {0}: Exit Code {1}. Script output:\n{2}", this /* document.base.resolve(page)*/, exitCode, scriptOutput));
				} else if (!debugPhantomJS && scriptOutput.length() > 2) {
					logger.log(Level.WARNING, MessageFormat.format("Conversion to SVG for {0} issued messages:\n{1}", this /* document.base.resolve(page) */, scriptOutput));
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

    private static ArrayList<String> getRenderCommandLine() {
        String renderScript = System.getProperty("node.script");
        final String renderBinary;
        if (renderScript == null) {
            renderBinary = System.getProperty("phantomjs.binary", "/usr/local/bin/phantomjs");
            renderScript = "rendersvgs.js";
        } else {
            renderBinary = System.getProperty("node.binary", "node");
        }

        final ArrayList<String> arguments = Lists.newArrayList(
                renderBinary,
                renderScript,
                serverURL);
        if (debugPhantomJS)
            arguments.add(1, "--debug=errors");
        if (arguments.get(0).contains("slimerjs"))
            arguments.add(1, "--headless");
        return arguments;
    }

    public static class Document {

		private final Path path;
		/** The base faust:// uri for the transcripts of this document */
		public URI base;
		/** The relative path to this document */
		public final Path relPath;
		/** The faust:// uri for this document */
		public URI faustURI;
		/** The sigil **/
		public String sigil;
		/** The machine readable version of the sigil */
		public String basename;

		public Document(final Path path) {
			this.path = path;
			relPath = root.relativize(path);
			faustURI = URI.create("faust://xml/" + relPath.toString());
		}

		public Stream<TranscriptPage> transcripts() {
			try {
				final XMLTag doc = XMLDoc.from(path.toFile()).deletePrefixes();
				sigil = doc.gotoTag("//idno[@type='faustedition']").getText();
				basename = sigil.replaceAll("α", "alpha").replaceAll("[^A-Za-z0-9.-]", "_");
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

	public static void writeJob(final Stream<Document> documents) throws IOException {
	    class TranscriptRepr {
            private final String json;
            private final int pageNo;
            private final String links;
            private final String out;

            public TranscriptRepr(TranscriptPage page) {
	            this.json = page.getJsonPath().toString();
	            this.pageNo = page.pageNo;
	            this.out = String.valueOf(page.getPagePath("svg"));
                this.links = page.getImageLinkPath().isPresent()? page.getImageLinkPath().get().toString(): null;

            }

            public String getJson() {
                return json;
            }

            public int getPageNo() {
                return pageNo;
            }

            public String getLinks() {
                return links;
            }

            public String getOut() {
                return out;
            }
        }
	    class DocumentRepr {

            private final String sigil;

            public Object[] getTranscripts() {
                return transcripts;
            }

            private final Object[] transcripts;

            public DocumentRepr(Document doc) {
	            this.transcripts = doc.transcripts().map(TranscriptRepr::new).toArray();
                this.sigil = doc.sigil;
            }

            public String getSigil() {
                return sigil;
            }
        }

        final Object[] docReprs = documents.map(DocumentRepr::new).toArray();
        final ObjectMapper objectMapper = new ObjectMapper();
        logger.info(docReprs[0].toString());
        objectMapper.writeValue(target.resolve("render-job.json").toFile(), docReprs);
    }

	public static void main(final String[] args) throws IOException {
		Properties properties = System.getProperties();
		System.setProperty("java.util.logging.SimpleFormatter.format", "%4$s: %5$s%n");
		onlyWebServer = Boolean.valueOf((String) properties.getOrDefault("faust.diplo.server", "false"));
		debugPhantomJS = Boolean.valueOf((String) properties.getOrDefault("faust.diplo.debug", "false"));
		final int listeningPort = Integer.valueOf((String) properties.getOrDefault("faust.diplo.port", "0"));
		final SimpleWebServer webServer = new SimpleWebServer("localhost", listeningPort, renderWebapp, true);
		webServer.start(60, true);
		try {
			serverURL = new URL("http", "localhost", webServer.getListeningPort(), "/transcript-generation.html").toString();
			logger.info(MessageFormat.format("Web server runs on {0}", serverURL));
			List<String> baseCmdLine = getRenderCommandLine();
			logger.info(() -> "Render script command line: " + String.join(" ", baseCmdLine) + " <input> <output> [<links> <linkoutput>]");
			
		
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
				ImmutableList<TranscriptPage> allPages = ImmutableList.copyOf(transcriptPages);

				logger.info("Writing render job description");
				writeJob(getDocuments());
				 
				 
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
						logger.log(Level.INFO, MessageFormat.format("Failed to convert {0} of {1} pages at try {2}", failedPages, totalPages, tries));
					}
					transcriptPages = failedConversions;
				} while (failedPages > 0 && failedPages < totalPages);
				
				postprocessPrintSVGs(allPages);
				

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
	
	private static void postprocessPrintSVGs(final List<TranscriptPage> transcripts) throws InterruptedException {
		logger.info("Creating SVGs with CSS ...");
		final Processor processor = new Processor(false);
		try {
			final XsltExecutable xslt = processor.newXsltCompiler().compile(new StreamSource(new File("src/main/resources/postprocess-svgs.xsl")));

			for (final TranscriptPage page : transcripts)
				try {
					XsltTransformer transformer = xslt.load();
					transformer.setParameter(new QName("css"), new XdmAtomicValue(cssURI));
					transformer.setSource(new StreamSource(diplomatic_path.resolve(page.getPagePath("svg")).toFile()));
					transformer.setDestination(processor.newSerializer(prepared_svg.resolve(page.getNewPagePath("svg")).toFile()));
					transformer.transform();
				} catch (SaxonApiException e) {
					logger.log(Level.WARNING, e, () -> MessageFormat.format("Failed to add CSS to {0}: {1}", page, e.getMessage()));
				}
		} catch (SaxonApiException e) {
			logger.log(Level.SEVERE, e, () -> MessageFormat.format("Failed to configure CSS inclusion: {0}", e.getMessage()));
		}
	}

	
	public static Path resolveFaustUri(final URI uri) {
		return root.resolve(uri.getPath().substring(1));
	}

	private static Stream<Document> getDocuments() throws IOException {
		return Files.walk(root.resolve(PROPERTY)).filter(path -> path.toString().endsWith(".xml")).map(
				path -> new Document(path));
	}
}
