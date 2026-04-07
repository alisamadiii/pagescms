import {
  getFileExtension,
  getFileName,
  getParentPath,
  joinPathSegments,
  normalizePath,
} from "@/lib/utils/file";

type LocaleEntry = {
  code: string;
  label?: string;
  fallback?: string[];
};

type RootLocalization = {
  default?: string;
  locales?: Array<string | LocaleEntry>;
};

type ContentLocalization = {
  scheme?: "files" | "fields";
  locales?: Array<string | LocaleEntry>;
  locale?: {
    type: "file" | "folder";
    position?: "prefix" | "suffix" | "root" | "collection" | "relative" | "custom";
    separator?: string;
    default?: "omit" | "explicit";
    root?: string;
  };
};

type LocalizationAwareSchema = {
  type?: "collection" | "file";
  path?: string;
  localization?: ContentLocalization;
};

type LocalizedFileInfo = {
  locale: string;
  basePath: string;
  siblings: Record<string, string>;
};

const isLocalizedFilesSchema = (
  schema?: LocalizationAwareSchema | null,
): boolean => Boolean(
  schema?.localization &&
  schema.localization.scheme !== "fields" &&
  schema.localization.locale,
);

const getLocaleOptions = (
  contentLocalization?: ContentLocalization,
  rootLocalization?: RootLocalization,
): Array<{ code: string; label: string }> => {
  const source = Array.isArray(contentLocalization?.locales) && contentLocalization.locales.length > 0
    ? contentLocalization.locales
    : rootLocalization?.locales;
  if (!Array.isArray(source)) return [];
  return source
    .map((locale) => typeof locale === "string"
      ? { code: locale, label: locale }
      : { code: locale?.code, label: locale?.label ?? locale?.code })
    .filter((locale): locale is { code: string; label: string } =>
      typeof locale.code === "string" &&
      locale.code.length > 0 &&
      typeof locale.label === "string" &&
      locale.label.length > 0);
};

const getLocaleCodes = (
  contentLocalization?: ContentLocalization,
  rootLocalization?: RootLocalization,
): string[] => {
  const source = Array.isArray(contentLocalization?.locales) && contentLocalization.locales.length > 0
    ? contentLocalization.locales
    : rootLocalization?.locales;
  if (!Array.isArray(source)) return [];
  return source
    .map((locale) => typeof locale === "string" ? locale : locale?.code)
    .filter((locale): locale is string => typeof locale === "string" && locale.length > 0);
};

const getDefaultLocale = (
  contentLocalization?: ContentLocalization,
  rootLocalization?: RootLocalization,
): string | undefined => {
  const localeCodes = getLocaleCodes(contentLocalization, rootLocalization);
  if (typeof rootLocalization?.default === "string" && rootLocalization.default.length > 0) {
    return rootLocalization.default;
  }
  return localeCodes[0];
};

const buildFileSiblingPath = (
  basePath: string,
  locale: string,
  defaultLocale: string,
  placement: NonNullable<ContentLocalization["locale"]>,
) => {
  const normalizedBasePath = normalizePath(basePath);
  const parentPath = getParentPath(normalizedBasePath);
  const filename = getFileName(normalizedBasePath);
  const extension = getFileExtension(filename);
  const stem = extension ? filename.slice(0, -(extension.length + 1)) : filename;
  const isDefault = locale === defaultLocale;
  const separator = placement.separator || "";
  const localizedStem = isDefault
    ? stem
    : placement.position === "prefix"
      ? `${locale}${separator}${stem}`
      : `${stem}${separator}${locale}`;
  const localizedFilename = extension
    ? `${localizedStem}.${extension}`
    : localizedStem;
  return joinPathSegments([parentPath, localizedFilename]);
};

const getFolderAnchorIndex = (
  placement: NonNullable<ContentLocalization["locale"]>,
  entryPath: string,
  schemaPath: string,
) => {
  const normalizedEntryPath = normalizePath(entryPath);
  const normalizedSchemaPath = normalizePath(schemaPath || "");
  switch (placement.position) {
    case "root":
      return 0;
    case "collection":
      return normalizedSchemaPath ? normalizedSchemaPath.split("/").length : 0;
    case "relative":
      return Math.max(normalizedEntryPath.split("/").length - 1, 0);
    case "custom":
      return placement.root ? normalizePath(placement.root).split("/").length : 0;
    default:
      return 0;
  }
};

const removeSegmentAt = (segments: string[], index: number) =>
  segments.filter((_, currentIndex) => currentIndex !== index);

const insertSegmentAt = (segments: string[], index: number, value: string) => {
  const result = [...segments];
  result.splice(index, 0, value);
  return result;
};

const buildFolderSiblingPath = (
  basePath: string,
  locale: string,
  defaultLocale: string,
  placement: NonNullable<ContentLocalization["locale"]>,
  schemaPath: string,
) => {
  const normalizedBasePath = normalizePath(basePath);
  const segments = normalizedBasePath ? normalizedBasePath.split("/") : [];
  const anchorIndex = getFolderAnchorIndex(placement, normalizedBasePath, schemaPath);
  const includeLocale = placement.default === "explicit" || locale !== defaultLocale;
  const localizedSegments = includeLocale
    ? insertSegmentAt(segments, anchorIndex, locale)
    : segments;
  return localizedSegments.join("/");
};

const inferFilePlacementLocale = (
  entryPath: string,
  placement: NonNullable<ContentLocalization["locale"]>,
  localeCodes: string[],
  defaultLocale: string,
): { locale: string; basePath: string } | null => {
  const normalizedEntryPath = normalizePath(entryPath);
  const parentPath = getParentPath(normalizedEntryPath);
  const filename = getFileName(normalizedEntryPath);
  const extension = getFileExtension(filename);
  const stem = extension ? filename.slice(0, -(extension.length + 1)) : filename;
  const sortedLocales = localeCodes
    .filter((locale) => locale !== defaultLocale)
    .sort((a, b) => b.length - a.length);

  if (placement.position === "prefix") {
    for (const locale of sortedLocales) {
      const prefix = `${locale}${placement.separator}`;
      if (stem.startsWith(prefix)) {
        const baseStem = stem.slice(prefix.length);
        const baseFilename = extension ? `${baseStem}.${extension}` : baseStem;
        return {
          locale,
          basePath: joinPathSegments([parentPath, baseFilename]),
        };
      }
    }
  }

  if (placement.position === "suffix") {
    for (const locale of sortedLocales) {
      const suffix = `${placement.separator}${locale}`;
      if (stem.endsWith(suffix)) {
        const baseStem = stem.slice(0, -suffix.length);
        const baseFilename = extension ? `${baseStem}.${extension}` : baseStem;
        return {
          locale,
          basePath: joinPathSegments([parentPath, baseFilename]),
        };
      }
    }
  }

  return {
    locale: defaultLocale,
    basePath: normalizedEntryPath,
  };
};

const inferFolderPlacementLocale = (
  entryPath: string,
  placement: NonNullable<ContentLocalization["locale"]>,
  localeCodes: string[],
  defaultLocale: string,
  schemaPath: string,
): { locale: string; basePath: string } | null => {
  const normalizedEntryPath = normalizePath(entryPath);
  const segments = normalizedEntryPath ? normalizedEntryPath.split("/") : [];
  const anchorIndex = getFolderAnchorIndex(placement, normalizedEntryPath, schemaPath);
  const localeAtAnchor = segments[anchorIndex];

  if (localeAtAnchor && localeCodes.includes(localeAtAnchor)) {
    return {
      locale: localeAtAnchor,
      basePath: removeSegmentAt(segments, anchorIndex).join("/"),
    };
  }

  if (placement.default === "explicit") return null;

  return {
    locale: defaultLocale,
    basePath: normalizedEntryPath,
  };
};

const inferLocalizedFileInfo = (
  entryPath: string,
  schema: LocalizationAwareSchema,
  rootLocalization?: RootLocalization,
): LocalizedFileInfo | null => {
  const localization = schema.localization;
  if (!localization || localization.scheme === "fields") return null;
  if (!localization.locale) return null;

  const localeCodes = getLocaleCodes(localization, rootLocalization);
  const defaultLocale = getDefaultLocale(localization, rootLocalization);
  if (localeCodes.length === 0 || !defaultLocale) return null;

  const inferred = localization.locale.type === "file"
    ? inferFilePlacementLocale(entryPath, localization.locale, localeCodes, defaultLocale)
    : inferFolderPlacementLocale(
      entryPath,
      localization.locale,
      localeCodes,
      defaultLocale,
      schema.path || "",
    );

  if (!inferred) return null;

  const siblings = Object.fromEntries(localeCodes.map((locale) => {
    const siblingPath = localization.locale?.type === "file"
      ? buildFileSiblingPath(inferred.basePath, locale, defaultLocale, localization.locale)
      : buildFolderSiblingPath(
        inferred.basePath,
        locale,
        defaultLocale,
        localization.locale!,
        schema.path || "",
      );
    return [locale, siblingPath];
  }));

  return {
    locale: inferred.locale,
    basePath: inferred.basePath,
    siblings,
  };
};

const resolveLocalizedSiblingPath = (
  currentPath: string,
  locale: string,
  schema: LocalizationAwareSchema,
  rootLocalization?: RootLocalization,
): string => {
  const normalizedCurrentPath = normalizePath(currentPath);
  if (!isLocalizedFilesSchema(schema)) return normalizedCurrentPath;

  const localization = schema.localization!;
  const localeCodes = getLocaleCodes(localization, rootLocalization);
  const defaultLocale = getDefaultLocale(localization, rootLocalization);
  if (!localeCodes.length || !defaultLocale || !localization.locale) {
    return normalizedCurrentPath;
  }

  const inferred = localization.locale.type === "file"
    ? inferFilePlacementLocale(normalizedCurrentPath, localization.locale, localeCodes, defaultLocale)
    : inferFolderPlacementLocale(
      normalizedCurrentPath,
      localization.locale,
      localeCodes,
      defaultLocale,
      schema.path || "",
    );

  const basePath = inferred?.basePath ?? normalizedCurrentPath;
  return localization.locale.type === "file"
    ? buildFileSiblingPath(basePath, locale, defaultLocale, localization.locale)
    : buildFolderSiblingPath(basePath, locale, defaultLocale, localization.locale, schema.path || "");
};

const getLocalizedRootPath = (
  schema: LocalizationAwareSchema,
  locale: string | undefined,
  rootLocalization?: RootLocalization,
): string => {
  const schemaPath = normalizePath(schema.path || "");
  if (!locale || !isLocalizedFilesSchema(schema)) return schemaPath;
  return resolveLocalizedSiblingPath(schemaPath, locale, schema, rootLocalization);
};

const isPathWithinLocalizedRoot = (
  entryPath: string,
  locale: string | undefined,
  schema: LocalizationAwareSchema,
  rootLocalization?: RootLocalization,
): boolean => {
  const normalizedPath = normalizePath(entryPath);
  const localizedRootPath = getLocalizedRootPath(schema, locale, rootLocalization);
  if (!normalizedPath || !localizedRootPath) return false;
  return normalizedPath === localizedRootPath || normalizedPath.startsWith(`${localizedRootPath}/`);
};

const isPathAllowedForSchema = (
  entryPath: string,
  schema: LocalizationAwareSchema,
  rootLocalization?: RootLocalization,
): boolean => {
  const normalizedPath = normalizePath(entryPath);
  const schemaPath = normalizePath(schema.path || "");
  const isFileSchema = schema.type === "file";

  if (!isLocalizedFilesSchema(schema)) {
    return isFileSchema
      ? normalizedPath === schemaPath
      : normalizedPath === schemaPath || normalizedPath.startsWith(`${schemaPath}/`);
  }

  const localized = inferLocalizedFileInfo(normalizedPath, schema, rootLocalization);
  if (!localized) return false;

  return isFileSchema
    ? localized.basePath === schemaPath
    : localized.basePath === schemaPath || localized.basePath.startsWith(`${schemaPath}/`);
};

export {
  isLocalizedFilesSchema,
  isPathAllowedForSchema,
  isPathWithinLocalizedRoot,
  getLocaleCodes,
  getLocaleOptions,
  getDefaultLocale,
  getLocalizedRootPath,
  inferLocalizedFileInfo,
  resolveLocalizedSiblingPath,
};
