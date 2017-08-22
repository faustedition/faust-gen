<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns="http://www.w3.org/2000/svg"
	xpath-default-namespace="http://www.w3.org/2000/svg"
	exclude-result-prefixes="xs"
	version="2.0">
	
	<xsl:param name="css" required="yes"/>
	<xsl:param name="css-content" select="unparsed-text($css)"/>
	<xsl:output method="xml" cdata-section-elements="style" indent="yes" normalization-form="NFC"/>
	

	<xsl:variable name="symbolachars">[&#x203F;&#x20B0;&#x2191;&#x2193;&#x22A2;&#x22A8;&#x2308;&#x2309;&#x23B1;&#x2E13;]+</xsl:variable>
	<xsl:variable name="unresolvedchars">[&#x07E0;&#x0301;&#x0304;&#x035C;]</xsl:variable>
	
	<xsl:template match="text()" priority="1">
		<xsl:variable name="content" select="normalize-unicode(., 'NFC')"/>
		<xsl:analyze-string select="$content" regex="[&#x203F;&#x20B0;&#x2191;&#x2193;&#x22A2;&#x22A8;&#x2308;&#x2309;&#x23B1;&#x2E13;]+|[&#x07E0;&#x0301;&#x0304;&#x035C;]">
			<xsl:matching-substring>
				<xsl:choose>
					<xsl:when test="matches(., $symbolachars)">
						<tspan class="symbola"><xsl:value-of select="."/></tspan>
					</xsl:when>
					<xsl:otherwise>
						<tspan class="unknown-char">$<xsl:value-of select="."/></tspan>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:matching-substring>
			<xsl:non-matching-substring><xsl:copy/></xsl:non-matching-substring>
		</xsl:analyze-string>
	</xsl:template>
	
	<xsl:template match="/svg">
		<xsl:copy>
			<xsl:apply-templates select="@*"/>
			<xsl:message select="concat('Including CSS ', $css)"/>			
			<defs>
				<style type="text/css">
					<xsl:copy-of select="$css-content"/>
				</style>
			</defs>
			<xsl:apply-templates select="node()"/>
		</xsl:copy>
	</xsl:template>
	
	<xsl:template match="rect[tokenize(@class, '\s+') = 'bgBox']"/>
	
	<!-- to simulate an outliney appearance in the web app we find the following code snippet:
	
          <g class="text-wrapper" transform="matrix(1, 0, 0, 1, 0, 0)">
            <rect class="bgBox hand-jo material-t script-gebr normal erase under" x="0" y="-12" height="15" width="17"/>
            <text class="text hand-jo material-t script-gebr normal erase under">zu</text>
            <g class="text-decoration-type-erase text-decoration" transform="matrix(1, 0, 0, 1, 0, 0)">
              <text class="text hand-jo material-t script-gebr normal erase under">zu</text>
            </g>
          </g>

		Since this will be rendered differently in print, the inner <g/> can be deleted.
	-->
	<xsl:template match="g[tokenize(@class, '\s+') = ('text-decoration-type-erase', 'text-decoration-type-rewrite') 
							and text 
							and preceding-sibling::*[1]/self::text 
							and text/text() = preceding-sibling::text[1]/text()]"/>
	
	
	
	<xsl:template match="node()|@*">
		<xsl:copy>
			<xsl:apply-templates select="@*, node()"/>
		</xsl:copy>
	</xsl:template>
	
</xsl:stylesheet>