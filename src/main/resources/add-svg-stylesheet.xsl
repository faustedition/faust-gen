<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns="http://www.w3.org/2000/svg"
	xpath-default-namespace="http://www.w3.org/2000/svg"
	exclude-result-prefixes="xs"
	version="2.0">
	
	<xsl:param name="css" required="yes"/>
	<xsl:param name="css-content" select="unparsed-text($css)"/>
	<xsl:output method="xml" cdata-section-elements="style"/>
	
	<xsl:template match="/svg">
		<xsl:copy>
			<xsl:apply-templates select="@*"/>
			<defs>
				<style type="text/css">
					<xsl:copy-of select="$css-content"/>
				</style>
			</defs>
			<xsl:apply-templates select="node()"/>
		</xsl:copy>
	</xsl:template>
	
	<xsl:template match="node()|@*">
		<xsl:copy>
			<xsl:apply-templates select="@*, node()"/>
		</xsl:copy>
	</xsl:template>
	
</xsl:stylesheet>