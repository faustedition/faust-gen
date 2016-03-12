package net.faustedition.gen.util;

import java.util.Iterator;

import javax.xml.XMLConstants;
import javax.xml.namespace.NamespaceContext;

import com.google.common.collect.ImmutableBiMap;
import com.google.common.collect.ImmutableMap;

public class SimpleNamespaceContext implements NamespaceContext {

	private final ImmutableBiMap<String, String> map;

	public SimpleNamespaceContext(final ImmutableMap<String, String> map) {
		this.map = ImmutableBiMap.<String, String> builder().putAll(map).build();
	}

	public String getNamespaceURI(String prefix) {
		return map.getOrDefault(prefix, XMLConstants.NULL_NS_URI);
	}

	public String getPrefix(String namespaceURI) {
		return map.inverse().get(namespaceURI);
	}

	@SuppressWarnings("rawtypes") // it's the API
	public Iterator getPrefixes(String namespaceURI) {
		return map.keySet().iterator();
	}

}
