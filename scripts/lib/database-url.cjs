function stripSchemaFromDatabaseUrl(url) {
  if (!url?.trim()) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('schema');
    return parsed.toString();
  } catch {
    return url.replace(/([?&])schema=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  }
}

function databaseUrlForSchema(schemaName, databaseUrl = process.env.DATABASE_URL) {
  const base = stripSchemaFromDatabaseUrl(databaseUrl?.trim());
  if (!base) throw new Error('DATABASE_URL is not set');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}schema=${encodeURIComponent(schemaName)}`;
}

module.exports = { stripSchemaFromDatabaseUrl, databaseUrlForSchema };
