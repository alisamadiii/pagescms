"use client";

import {
  Fragment,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConfig } from "@/contexts/config-context";
import {
  getDefaultLocale,
  getLocaleCodes,
  getLocaleOptions,
  getLocalizedRootPath,
  isLocalizedFilesSchema,
  isPathWithinLocalizedRoot,
  resolveLocalizedSiblingPath,
} from "@/lib/localization";
import { RepoActionButtons } from "@/components/repo/repo-action-buttons";
import {
  getParentPath,
  getFileName,
  getRelativePath,
  joinPathSegments,
  normalizePath,
  sortFiles,
} from "@/lib/utils/file";
import { viewComponents } from "@/fields/registry";
import { getSchemaActions } from "@/lib/actions";
import {
  getSchemaByName,
  getPrimaryField,
  getFieldByPath,
  safeAccess,
} from "@/lib/schema";
import { requireApiSuccess } from "@/lib/api-client";
import { EmptyCreate } from "@/components/empty-create";
import { FileOptions } from "@/components/file/file-options";
import { CollectionTable } from "./collection-table";
import { FolderCreate } from "@/components/folder-create";
import { TranslationMenu } from "@/components/localization/translation-menu";
import { resolveContentOperations } from "@/lib/operations";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSWR, { useSWRConfig } from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical, FolderPlus, Languages, Plus, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type GroupTrailItem = {
  name: string;
  label?: string | null;
};

const CollectionRowTranslationMenu = memo(function CollectionRowTranslationMenu({
  branch,
  currentLocale,
  localeOptions,
  name,
  owner,
  path,
  repo,
  siblings,
}: {
  branch: string;
  currentLocale: string;
  localeOptions: Array<{ code: string; label: string }>;
  name: string;
  owner: string;
  path: string;
  repo: string;
  siblings: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingLocales, setExistingLocales] = useState<string[] | undefined>(undefined);
  const [missingLocales, setMissingLocales] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    if (!isOpen || isLoading || existingLocales || missingLocales) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/${owner}/${repo}/${encodeURIComponent(branch)}/entries/${encodeURIComponent(path)}?name=${encodeURIComponent(name)}&meta=1`,
        );
        const result = await requireApiSuccess<any>(response, "Failed to fetch translation state");
        if (cancelled) return;
        setExistingLocales(result.data.localization?.availableLocales || []);
        setMissingLocales(result.data.localization?.missingLocales || []);
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || "Failed to fetch translation state");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [branch, existingLocales, isLoading, isOpen, missingLocales, name, owner, path, repo]);

  return (
    <TranslationMenu
      branch={branch}
      contextType="collection"
      currentLocale={currentLocale}
      existingLocales={existingLocales}
      iconOnly
      loading={isLoading || !existingLocales || !missingLocales}
      localeOptions={localeOptions}
      missingLocales={missingLocales}
      name={name}
      onOpenChange={setIsOpen}
      owner={owner}
      path={path}
      repo={repo}
      siblings={siblings}
      size="sm"
      variant="outline"
    />
  );
});

const CollectionHeaderActions = memo(function CollectionHeaderActions({
  addEntryHref,
  actionNode,
  collectionPath,
  localeCodes,
  localeOptions,
  name,
  onLocaleChange,
  showAddEntry,
  showFolderCreate,
  onFolderCreate,
  onSearchChange,
  selectedLocale,
  showAllLocales,
}: {
  addEntryHref: string;
  actionNode?: ReactNode;
  collectionPath: string;
  localeCodes: string[];
  localeOptions: Array<{ code: string; label: string }>;
  name: string;
  onLocaleChange: (value: string) => void;
  showAddEntry: boolean;
  showFolderCreate: boolean;
  onFolderCreate: (entry: any) => void;
  onSearchChange: (value: string) => void;
  selectedLocale: string;
  showAllLocales: boolean;
}) {
  const [searchInput, setSearchInput] = useState("");
  const selectedLocaleLabel = selectedLocale === "all"
    ? "All translations"
    : localeOptions.find((locale) => locale.code === selectedLocale)?.label ?? selectedLocale;

  useEffect(() => {
    const timeout = setTimeout(() => onSearchChange(searchInput), 200);
    return () => clearTimeout(timeout);
  }, [searchInput, onSearchChange]);

  return (
    <div className="flex items-center gap-x-2">
      {actionNode}
      {localeCodes.length > 0 && (
        <Select value={selectedLocale} onValueChange={onLocaleChange}>
          <SelectTrigger className="w-auto min-w-0 shrink-0">
            <div className="flex items-center gap-2">
              <Languages className="size-4" />
              <SelectValue placeholder={selectedLocaleLabel} />
            </div>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {localeOptions.map((locale) => (
                <SelectItem key={locale.code} value={locale.code}>
                  {locale.label}
                </SelectItem>
              ))}
            </SelectGroup>
            {showAllLocales && (
              <>
                <SelectSeparator />
                <SelectItem value="all">All translations</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      )}
      <div className="relative hidden sm:block w-52 md:w-64">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
        <Input
          className="pl-9"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search entries..."
        />
      </div>
      {showFolderCreate && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <FolderCreate
                path={collectionPath}
                type="content"
                name={name}
                onCreate={onFolderCreate}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  size="icon"
                >
                  <FolderPlus />
                </Button>
              </FolderCreate>
            </div>
          </TooltipTrigger>
          <TooltipContent>Create folder</TooltipContent>
        </Tooltip>
      )}
      {showAddEntry && (
        <>
          <Link
            className={cn(buttonVariants(), "hidden sm:flex")}
            href={addEntryHref}
          >
            Add an entry
          </Link>
          <Link
            className={cn(buttonVariants({ size: "icon" }), "sm:hidden shrink-0")}
            href={addEntryHref}
          >
            <Plus className="size-4" />
          </Link>
        </>
      )}
    </div>
  );
});

export function Collection({ name, path }: { name: string; path?: string }) {
  const [tableSearch, setTableSearch] = useState("");
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [persistedLocale, setPersistedLocale] = useState<string | null>(null);
  const [localeHydrated, setLocaleHydrated] = useState(false);
  const { cache, mutate } = useSWRConfig();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);

  const schema = useMemo(
    () => getSchemaByName(config?.object, name),
    [config, name],
  );
  if (!schema) throw new Error(`Schema not found for "${name}".`);
  if (schema.type !== "collection")
    throw new Error(`"${name}" is not a collection.`);
  const operations = useMemo(() => resolveContentOperations({ schema }), [schema]);
  const canCreate = operations.create;
  const canRename = operations.rename;
  const canDelete = operations.delete;
  const isLocalizedCollection = useMemo(
    () => isLocalizedFilesSchema(schema),
    [schema],
  );
  const localeCodes = useMemo(
    () => isLocalizedCollection
      ? getLocaleCodes(schema.localization, config.object?.localization)
      : [],
    [config.object, isLocalizedCollection, schema.localization],
  );
  const localeOptions = useMemo(
    () => isLocalizedCollection
      ? getLocaleOptions(schema.localization, config.object?.localization)
      : [],
    [config.object, isLocalizedCollection, schema.localization],
  );
  const defaultLocale = useMemo(
    () => isLocalizedCollection
      ? getDefaultLocale(schema.localization, config.object?.localization)
      : undefined,
    [config.object, isLocalizedCollection, schema.localization],
  );
  const showAllLocales = useMemo(
    () => schema.localization?.locale?.type === "file",
    [schema.localization?.locale?.type],
  );
  const requestedLocale = searchParams.get("locale");
  const localeStorageKey = useMemo(
    () => `collection-locale:${config.owner}/${config.repo}/${config.branch}/${name}`,
    [config.branch, config.owner, config.repo, name],
  );
  const selectedLocale = useMemo(() => {
    if (requestedLocale && localeCodes.includes(requestedLocale)) return requestedLocale;
    if (showAllLocales && requestedLocale === "all") return "all";
    if (persistedLocale && localeCodes.includes(persistedLocale)) return persistedLocale;
    if (showAllLocales && persistedLocale === "all") return "all";
    return defaultLocale ?? (showAllLocales ? "all" : null);
  }, [defaultLocale, localeCodes, persistedLocale, requestedLocale, showAllLocales]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPersistedLocale(window.localStorage.getItem(localeStorageKey));
    setLocaleHydrated(true);
  }, [localeStorageKey]);

  const viewFields = useMemo(() => {
    let pathAndFieldArray: any[] = [];
    if (schema.fields) {
      if (schema.view?.fields && schema.view?.fields.length > 0) {
        // If we have a list of fields defined for the view
        schema.view.fields.forEach((path: string) => {
          const field = getFieldByPath(schema.fields, path);
          if (field && !["object", "block"].includes(field.type))
            pathAndFieldArray.push({ path: path, field: field });
        });
      } else {
        pathAndFieldArray = schema.fields
          .filter(
            (field: any) =>
              !["object", "block"].includes(field.type) && !field.hidden,
          )
          .map((field: any) => ({ path: field.name, field: field }));
      }
    } else {
      pathAndFieldArray.push({
        path: "name",
        field: {
          label: "Name",
          name: "name",
          type: "string",
        },
      });
    }

    // If the filename starts with {year}-{month}-{day} and date is listed in the
    // view fields and is not an actual field, or if there are no fields, we add a date field
    if (
      !pathAndFieldArray.find((item: any) => item.path === "date") &&
      schema.filename.startsWith("{year}-{month}-{day}") &&
      ((schema.view?.fields && schema.view?.fields.includes("date")) ||
        !schema.view?.fields)
    ) {
      pathAndFieldArray.push({
        path: "date",
        field: {
          label: "Date",
          name: "date",
          type: "date",
        },
      });
    }

    if (
      localeOptions.length > 0 &&
      !pathAndFieldArray.find((item: any) => item.path === "locale") &&
      ((schema.view?.fields && schema.view.fields.includes("locale")) || !schema.view?.fields)
    ) {
      pathAndFieldArray.push({
        path: "locale",
        field: {
          label: "Locale",
          name: "locale",
          type: "string",
        },
      });
    }

    return pathAndFieldArray;
  }, [localeOptions.length, schema]);

  const primaryField = useMemo(
    () => getPrimaryField(schema) ?? "name",
    [schema],
  );
  const collectionActions = useMemo(
    () => getSchemaActions(schema, "collection"),
    [schema],
  );
  const requestedFieldPaths = useMemo(() => {
    const paths = new Set<string>(["name", "path", primaryField]);
    viewFields.forEach((item: any) => paths.add(item.path));
    return Array.from(paths);
  }, [primaryField, viewFields]);

  const handleTableSearchChange = useCallback((value: string) => {
    setTableSearch(value);
  }, []);

  const localizedRootPath = useMemo(
    () =>
      selectedLocale && selectedLocale !== "all"
        ? getLocalizedRootPath(schema, selectedLocale, config.object?.localization)
        : normalizePath(schema.path),
    [config.object?.localization, schema, selectedLocale],
  );

  const collectionPath = useMemo(() => {
    const requestedPath = normalizePath(path || "");
    if (schema.view?.layout === "tree") return localizedRootPath;
    if (!requestedPath) return localizedRootPath;

    if (
      selectedLocale &&
      selectedLocale !== "all" &&
      schema.localization?.locale?.type === "folder"
    ) {
      if (
        isPathWithinLocalizedRoot(
          requestedPath,
          selectedLocale,
          schema,
          config.object?.localization,
        )
      ) {
        return requestedPath;
      }

      return resolveLocalizedSiblingPath(
        requestedPath,
        selectedLocale,
        schema,
        config.object?.localization,
      );
    }

    return requestedPath;
  }, [
    config.object?.localization,
    localizedRootPath,
    path,
    schema,
    schema.view?.layout,
    selectedLocale,
  ]);

  const buildCollectionUrl = useCallback(
    (nextPath?: string, nextLocale?: string | null) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      const effectiveLocale = nextLocale === undefined ? selectedLocale : nextLocale;

      if (effectiveLocale && effectiveLocale !== "all") {
        params.set("locale", effectiveLocale);
      } else {
        params.delete("locale");
      }

      const targetRootPath =
        effectiveLocale && effectiveLocale !== "all"
          ? getLocalizedRootPath(schema, effectiveLocale, config.object?.localization)
          : normalizePath(schema.path);
      const normalizedNextPath = normalizePath(nextPath || "");

      if (normalizedNextPath && normalizedNextPath !== targetRootPath) {
        params.set("path", normalizedNextPath);
      } else {
        params.delete("path");
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [
      config.object?.localization,
      pathname,
      schema,
      searchParams,
      selectedLocale,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !localeHydrated || !selectedLocale) return;
    window.localStorage.setItem(localeStorageKey, selectedLocale);
  }, [localeHydrated, localeStorageKey, selectedLocale]);

  useEffect(() => {
    if (!localeHydrated || !selectedLocale) return;
    const hasValidRequestedLocale =
      (requestedLocale != null && localeCodes.includes(requestedLocale)) ||
      (requestedLocale === "all" && showAllLocales);
    if (hasValidRequestedLocale) return;

    const canonicalUrl = buildCollectionUrl(collectionPath, selectedLocale);
    const currentQuery = searchParams.toString();
    const canonicalQuery = canonicalUrl.split("?")[1] ?? "";
    if (canonicalQuery === currentQuery) return;
    router.replace(canonicalUrl);
  }, [
    buildCollectionUrl,
    collectionPath,
    localeCodes,
    localeHydrated,
    requestedLocale,
    router,
    searchParams,
    selectedLocale,
    showAllLocales,
  ]);

  const buildCollectionApiUrl = useCallback(
    (fetchPath: string): string => {
      const params = new URLSearchParams({
        fields: requestedFieldPaths.join(","),
      });
      if (fetchPath) {
        params.set("path", fetchPath);
      }
      if (selectedLocale && selectedLocale !== "all") {
        params.set("locale", selectedLocale);
      }
      return `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?${params.toString()}`;
    },
    [config.branch, config.owner, config.repo, name, requestedFieldPaths, selectedLocale],
  );

  const fetchCollectionByUrl = useCallback(
    async (apiUrl: string): Promise<Record<string, any>[]> => {
      const response = await fetch(apiUrl);
      const result = await requireApiSuccess<any>(response, "Fetch failed");

      if (result.data.errors?.length) {
        result.data.errors.forEach((e: any) => toast.error(e));
      }

      const unsortedData = result.data.contents || [];
      if (unsortedData.length === 0) return [];
      return unsortedData.sort((a: any, b: any) => {
        if (a.type === "dir" && b.type === "file")
          return schema.view?.foldersFirst ? -1 : 1;
        if (a.type === "file" && b.type === "dir")
          return schema.view?.foldersFirst ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    },
    [schema.view?.foldersFirst],
  );

  const rootCollectionKey = useMemo(
    () => buildCollectionApiUrl(collectionPath),
    [buildCollectionApiUrl, collectionPath],
  );

  const { data: swrCollectionData, error: swrCollectionError } = useSWR<
    Record<string, any>[]
  >(rootCollectionKey, fetchCollectionByUrl, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  });

  useEffect(() => {
    setData([]);
    setError(null);
  }, [rootCollectionKey]);

  useEffect(() => {
    if (!swrCollectionData) return;
    setData(swrCollectionData);
    setError(null);
  }, [swrCollectionData]);

  useEffect(() => {
    if (!swrCollectionError) return;
    setError(
      swrCollectionError instanceof Error
        ? swrCollectionError.message
        : "Fetch failed",
    );
  }, [swrCollectionError]);

  const fetchCollectionData = useCallback(
    async (fetchPath: string): Promise<Record<string, any>[] | undefined> => {
      const apiUrl = buildCollectionApiUrl(fetchPath);
      const cachedValue = cache.get(apiUrl) as
        | { data?: Record<string, any>[] }
        | undefined;
      if (cachedValue?.data) return cachedValue.data;

      try {
        const rows = await fetchCollectionByUrl(apiUrl);
        await mutate(apiUrl, rows, { revalidate: false });
        return rows;
      } catch (err: any) {
        console.error(`Fetch failed for path ${fetchPath}:`, err);
        if (fetchPath === collectionPath) {
          setError(err.message);
        } else {
          toast.error(
            `Could not load items inside ${getFileName(fetchPath)}: ${err.message}`,
          );
        }
        return undefined;
      }
    },
    [
      buildCollectionApiUrl,
      cache,
      collectionPath,
      fetchCollectionByUrl,
      mutate,
    ],
  );

  const handleDelete = useCallback((path: string) => {
    setData((prevData) => prevData?.filter((item: any) => item.path !== path));
  }, []);

  const handleRename = useCallback((path: string, newPath: string) => {
    setData((prevData: any) => {
      if (!prevData) return prevData;

      const updateNestedData = (items: any[]): any[] => {
        return items.map((item: any) => {
          // If this is the item being renamed
          if (item.path === path) {
            return { ...item, path: newPath, name: getFileName(newPath) };
          }

          // If this item has subRows, recursively update them
          if (item.subRows && Array.isArray(item.subRows)) {
            const updatedSubRows = updateNestedData(item.subRows);
            // Only create a new item reference if subRows changed
            if (updatedSubRows !== item.subRows) {
              return { ...item, subRows: updatedSubRows };
            }
          }

          // Return the original item if no changes
          return item;
        });
      };

      // Check if the item is moving to a different folder
      if (
        getParentPath(normalizePath(path)) !==
        getParentPath(normalizePath(newPath))
      ) {
        // For items moved to a different folder, we need to:
        // 1. Remove the item from its original location (recursively)
        const removeItem = (items: any[]): any[] => {
          return items
            .filter((item) => item.path !== path)
            .map((item) => {
              if (item.subRows && Array.isArray(item.subRows)) {
                const updatedSubRows = removeItem(item.subRows);
                if (updatedSubRows !== item.subRows) {
                  return { ...item, subRows: updatedSubRows };
                }
              }
              return item;
            });
        };

        return sortFiles(removeItem(prevData));
      }

      // For items renamed within the same folder, update the item
      return sortFiles(updateNestedData(prevData));
    });
  }, []);

  const handleFolderCreate = useCallback((entry: any) => {
    const parentPath = getParentPath(entry.path);
    const parent = {
      type: "dir",
      name: getFileName(parentPath),
      path: parentPath,
      size: 0,
      url: null,
    };

    setData((prevData) => {
      if (!prevData) return [parent];
      return sortFiles([...prevData, parent]);
    });
  }, []);

  const handleConfirmRenameNode = useCallback(
    (path: string, newPath: string) => {
      try {
        const normalizedPath = normalizePath(path);
        const normalizedNewPath = normalizePath(newPath);

        const renamePromise = new Promise(async (resolve, reject) => {
          try {
            const response = await fetch(
              `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(normalizedPath)}/rename`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "content",
                  name,
                  newPath: normalizedNewPath,
                }),
              },
            );
            const data = await requireApiSuccess<any>(
              response,
              "Failed to rename file",
            );

            resolve(data);
          } catch (error) {
            reject(error);
          }
        });

        toast.promise(renamePromise, {
          loading: `Renaming "${path}" to "${newPath}"`,
          success: (data: any) => {
            router.push(buildCollectionUrl(getParentPath(normalizedNewPath)));
            return data.message;
          },
          error: (error: any) => error.message,
        });
      } catch (error) {
        console.error(error);
      }
    },
    [buildCollectionUrl, config.owner, config.repo, config.branch, name, router],
  );

  const buildNewEntryHref = useCallback(
    (parentPath?: string) => {
      const params = new URLSearchParams();
      if (selectedLocale && selectedLocale !== "all") {
        params.set("locale", selectedLocale);
      }
      if (parentPath && normalizePath(parentPath) !== localizedRootPath) {
        params.set("parent", parentPath);
      }
      const query = params.toString();
      return `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/new${query ? `?${query}` : ""}`;
    },
    [
      config.branch,
      config.owner,
      config.repo,
      localizedRootPath,
      name,
      selectedLocale,
    ],
  );

  const columns = useMemo(() => {
    let tableColumns: any;
    tableColumns =
      viewFields
        .map((pathAndField: any) => {
          const path = pathAndField.path;
          const field = pathAndField.field;
          if (!field) return null;

          return {
            id: path,
            accessorKey: path,
            accessorFn: (originalRow: any) =>
              path === "locale"
                ? originalRow.localization?.locale
                : safeAccess(originalRow.fields, path),
            header: field?.label ?? field.name,
            meta: {
              className:
                path === primaryField
                  ? "truncate w-full min-w-[12rem] max-w-[1px]"
                  : "",
            },
            cell: ({ cell, row }: { cell: any; row: any }) => {
              const cellValue = cell.getValue();
              if (path === "locale") {
                if (!cellValue) return null;
                const localeLabel = localeOptions.find((locale) => locale.code === cellValue)?.label ?? cellValue;
                return (
                  <Badge variant="secondary" className="shrink-0">
                    <Languages className="size-3.5" />
                    {localeLabel}
                  </Badge>
                );
              }
              const FieldComponent = viewComponents?.[field.type];
              const CellView = FieldComponent ? (
                <FieldComponent value={cellValue} field={field} />
              ) : Array.isArray(cellValue) ? (
                cellValue.join(", ")
              ) : (
                cellValue
              );
              if (path === primaryField) {
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      className="font-medium truncate"
                      href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(row.original.path)}`}
                    >
                      {CellView}
                    </Link>
                  </div>
                );
              }
              return (
                <div className="truncate w-full max-w-[12rem]">{CellView}</div>
              );
            },
            sortUndefined: schema.view?.foldersFirst ? "first" : "last",
          };
        })
        .filter(Boolean) || [];

    tableColumns.push({
      accessorKey: "actions",
      header: "",
      cell: ({ row }: { row: any }) => (
        <div className="flex gap-1 justify-end">
          {row.original.type === "file" && row.original.localization?.siblings && row.original.localization?.locale && (
            <CollectionRowTranslationMenu
              branch={config.branch}
              currentLocale={row.original.localization.locale}
              localeOptions={localeOptions}
              name={name}
              owner={config.owner}
              path={row.original.path}
              repo={config.repo}
              siblings={row.original.localization.siblings}
            />
          )}
          {row.original.type === "file" && (
            <ButtonGroup>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
                href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${name}/edit/${encodeURIComponent(row.original.path)}`}
              >
                Edit
              </Link>
              <FileOptions
                path={row.original.path}
                sha={row.original.sha}
                type="collection"
                name={name}
                canDelete={canDelete}
                canRename={canRename}
                onDelete={handleDelete}
                onRename={handleRename}
              >
                <Button variant="outline" size="icon-sm">
                  <EllipsisVertical />
                </Button>
              </FileOptions>
            </ButtonGroup>
          )}
          {canCreate &&
            schema.view?.layout === "tree" &&
            (row.original.type === "file" &&
            !row.original.isNode &&
            !(
              row.depth === 0 &&
              row.original.name === schema.view?.node?.filename
            ) ? (
              canRename ? (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="w-8 h-8"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Add children entry</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rename this file first?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Before adding children to this file, you must rename it
                      from &quot;{row.original.path}&quot; to &quot;
                      {row.original.path.replace(
                        `.${schema.extension}`,
                        `/${schema.view?.node?.filename}`,
                      )}
                      &quot;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        handleConfirmRenameNode(
                          row.original.path,
                          row.original.path.replace(
                            `.${schema.extension}`,
                            `/${schema.view?.node?.filename}`,
                          ),
                        )
                      }
                    >
                      Rename
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              ) : null
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon-sm" }),
                      "w-8 h-8",
                    )}
                    href={
                      row.original.isNode
                        ? buildNewEntryHref(row.original.parentPath)
                        : row.original.type === "dir"
                          ? buildNewEntryHref(row.original.path)
                          : buildNewEntryHref(row.original.path)
                    }
                  >
                    <Plus className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Add children entry</TooltipContent>
              </Tooltip>
            ))}
        </div>
      ),
      enableSorting: false,
    });

    return tableColumns;
  }, [
    config.owner,
    config.repo,
    config.branch,
    name,
    viewFields,
    primaryField,
    handleDelete,
    handleRename,
    schema.view?.foldersFirst,
    schema.view?.layout,
    schema.view?.node?.filename,
    schema.extension,
    handleConfirmRenameNode,
    canCreate,
    canDelete,
    canRename,
    buildNewEntryHref,
    localeOptions,
  ]);

  const filteredData = useMemo(() => {
    if (selectedLocale == null || selectedLocale === "all") return data;

    const localeSet = new Set(localeCodes);
    const filterRows = (rows: Record<string, any>[]): Record<string, any>[] =>
      rows
        .filter((item) => {
          if (item.type === "file") {
            return item.localization?.locale === selectedLocale;
          }

          if (
            item.type === "dir" &&
            schema.localization?.scheme === "files" &&
            schema.localization?.locale?.type === "folder"
          ) {
            const isLocaleDir = localeSet.has(item.name);
            return !isLocaleDir || item.name === selectedLocale;
          }

          return true;
        })
        .map((item) => item.subRows ? { ...item, subRows: filterRows(item.subRows) } : item);

    return filterRows(data);
  }, [data, localeCodes, schema.localization, selectedLocale]);

  const initialState = useMemo(() => {
    const sortId =
      viewFields == null
        ? "name"
        : schema.view?.default?.sort ||
          (viewFields.find((item: any) => item.field.name === "date") &&
            "date") ||
          primaryField;

    return {
      sorting: [
        {
          id: sortId,
          desc:
            sortId === "date"
              ? true
              : schema.view?.default?.order === "desc"
                ? true
                : false,
        },
      ],
      pagination: {
        pageSize: 25,
      },
    };
  }, [schema, primaryField, viewFields]);

  const handleNavigate = useCallback(
    (newPath: string) => {
      router.push(buildCollectionUrl(newPath));
    },
    [buildCollectionUrl, router],
  );

  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      const relativePath = getRelativePath(collectionPath, localizedRootPath);
      const nextRootPath =
        nextLocale !== "all"
          ? getLocalizedRootPath(schema, nextLocale, config.object?.localization)
          : normalizePath(schema.path);
      const nextPath = relativePath
        ? joinPathSegments([nextRootPath, relativePath])
        : nextRootPath;
      router.push(buildCollectionUrl(nextPath, nextLocale));
    },
    [
      buildCollectionUrl,
      collectionPath,
      config.object?.localization,
      localizedRootPath,
      router,
      schema,
    ],
  );

  const handleExpand = useCallback(
    async (row: any) => {
      if (!row) return;
      const subRows = await fetchCollectionData(
        row.isNode ? row.parentPath : row.path,
      );
      if (subRows !== undefined) {
        setData((currentData: any[]) => {
          const updateNestedData = (items: any[]): any[] => {
            return items.map((item: any) => {
              if (item.path === row.path) return { ...item, subRows };
              if (item.subRows && Array.isArray(item.subRows)) {
                const updatedSubRows = updateNestedData(item.subRows);
                if (updatedSubRows !== item.subRows) {
                  return { ...item, subRows: updatedSubRows };
                }
              }
              return item;
            });
          };

          return updateNestedData(currentData);
        });
      }
    },
    [fetchCollectionData],
  );

  const loadingSkeleton = useMemo(
    () => (
      <table className="w-full">
        <thead>
          <tr className="border-b font-medium">
            <th className="p-2 h-10 align-middle">
              <Skeleton className="w-8 h-4 rounded" />
            </th>
            <th className="p-2 h-10 align-middle">
              <Skeleton className="w-16 h-4 rounded" />
            </th>
            <th className="p-2 h-10 align-middle">
              <Skeleton className="w-12 h-4 rounded" />
            </th>
            <th className="p-2 h-10 align-middle">
              <Skeleton className="w-12 h-4 rounded" />
            </th>
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, index) => (
            <tr className="border-b" key={index}>
              <td className="p-2 py-0 h-12 align-middle">
                <Skeleton className="h-8 w-8 rounded-md" />
              </td>
              <td className="p-2 py-0 h-12 align-middle w-full min-w-[12rem] max-w-px">
                <Skeleton className="w-full h-5 rounded" />
              </td>
              <td className="p-2 py-0 h-12 align-middle">
                <Skeleton className="w-24 h-5 rounded" />
              </td>
              <td className="p-2 py-0 h-12 align-middle">
                <div className="flex gap-1 justify-end">
                  <ButtonGroup>
                    <Button variant="outline" size="sm" disabled>
                      Edit
                    </Button>
                    <Button variant="outline" size="icon-sm" disabled>
                      <EllipsisVertical className="size-4" />
                    </Button>
                  </ButtonGroup>
                  {schema.view?.layout === "tree" && (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="w-8 h-8"
                      disabled
                    >
                      <Plus className="size-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    [schema.view?.layout],
  );

  const addEntryHref = useMemo(
    () =>
      schema.view?.layout !== "tree"
        ? buildNewEntryHref(collectionPath)
        : buildNewEntryHref(),
    [buildNewEntryHref, collectionPath, schema.view?.layout],
  );

  const breadcrumbNode = useMemo(() => {
    const groupTrail: GroupTrailItem[] = Array.isArray(schema.groupTrail)
      ? schema.groupTrail
      : [];
    const normalizedRootPath = normalizePath(localizedRootPath);
    const normalizedCurrentPath = normalizePath(collectionPath);
    const relativePath = getRelativePath(
      normalizedCurrentPath,
      normalizedRootPath,
    );
    const segments = relativePath
      ? relativePath.split("/").filter(Boolean)
      : [];

    const entries = segments.map((segment, index) => ({
      name: segment,
      path: joinPathSegments([
        normalizedRootPath,
        segments.slice(0, index + 1).join("/"),
      ]),
    }));

    const middleEntries = entries.length > 3 ? entries.slice(1, -1) : [];
    const visibleEntries =
      entries.length > 3 ? [entries[0], entries[entries.length - 1]] : entries;

    return (
      <Breadcrumb>
        <BreadcrumbList className="font-semibold text-lg flex-nowrap">
          {groupTrail.map((group) => (
            <Fragment key={`group-${group.name}`}>
              <BreadcrumbItem>
                <span>{group.label || group.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem
            className={
              entries.length === 0 ? "min-w-0 max-w-full truncate" : undefined
            }
          >
            {entries.length > 0 ? (
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => handleNavigate(localizedRootPath)}
              >
                {schema.label || schema.name}
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="block max-w-full font-semibold truncate">
                {schema.label || schema.name}
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {entries.length > 0 && <BreadcrumbSeparator />}

          {entries.length > 3 && (
            <>
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center">
                    <BreadcrumbEllipsis className="size-4" />
                    <span className="sr-only">Show hidden segments</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {middleEntries.map((entry) => (
                      <DropdownMenuItem
                        key={entry.path}
                        onClick={() => handleNavigate(entry.path)}
                        className="cursor-pointer"
                      >
                        {entry.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}

          {visibleEntries.map((entry, index) => {
            const isLast = index === visibleEntries.length - 1;
            return (
              <Fragment key={entry.path}>
                <BreadcrumbItem
                  className={isLast ? "min-w-0 max-w-full truncate" : undefined}
                >
                  {isLast ? (
                    <BreadcrumbPage className="block max-w-full font-semibold truncate">
                      {entry.name}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="cursor-pointer"
                      onClick={() => handleNavigate(entry.path)}
                    >
                      {entry.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }, [
    collectionPath,
    handleNavigate,
    schema.groupTrail,
    schema.label,
    schema.name,
    localizedRootPath,
  ]);

  const headerNode = useMemo(
    () => (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate">{breadcrumbNode}</div>
        <CollectionHeaderActions
          addEntryHref={addEntryHref}
          actionNode={
            collectionActions.length > 0 ? (
              <RepoActionButtons
                actions={collectionActions}
                owner={config.owner}
                repo={config.repo}
                refName={config.branch}
                contextType="collection"
                contextName={schema.name}
                contextPath={collectionPath}
                contextData={{
                  label: schema.label || schema.name,
                  rootPath: localizedRootPath,
                  format: schema.format ?? null,
                }}
              />
            ) : undefined
          }
          collectionPath={collectionPath}
          localeCodes={localeCodes}
          localeOptions={localeOptions}
          name={name}
          onLocaleChange={handleLocaleChange}
          showAddEntry={canCreate}
          showFolderCreate={schema.subfolders !== false && canCreate}
          onFolderCreate={handleFolderCreate}
          onSearchChange={handleTableSearchChange}
          selectedLocale={selectedLocale ?? "all"}
          showAllLocales={showAllLocales}
        />
      </div>
    ),
    [
      addEntryHref,
      breadcrumbNode,
      collectionActions,
      collectionPath,
      config.branch,
      config.owner,
      config.repo,
      handleFolderCreate,
      handleLocaleChange,
      handleTableSearchChange,
      canCreate,
      localeCodes,
      localeOptions,
      name,
      selectedLocale,
      schema.format,
      schema.label,
      schema.name,
      schema.subfolders,
      showAllLocales,
      localizedRootPath,
    ],
  );

  useRepoHeader({
    header: headerNode,
  });

  const isLoading =
    !swrCollectionData && !swrCollectionError && data.length === 0;

  const contentNode = isLoading ? (
    loadingSkeleton
  ) : error ? (
    <div className="flex flex-1 items-center justify-center">
      <Empty className="max-w-[420px] flex-none">
        <EmptyHeader>
          <EmptyTitle>
            {error === "Not found"
              ? "Folder not found"
              : "Something went wrong"}
          </EmptyTitle>
          <EmptyDescription>
            {error === "Not found"
              ? `The collection folder "${localizedRootPath}" does not exist yet.`
              : error}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {error === "Not found" ? (
            canCreate ? (
              <EmptyCreate type="content" name={schema.name}>
                Create folder
              </EmptyCreate>
            ) : null
          ) : (
            <Link
              className={buttonVariants({ variant: "default" })}
              href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/settings`}
            >
              Go to settings
            </Link>
          )}
        </EmptyContent>
      </Empty>
    </div>
  ) : (
    <CollectionTable
      columns={columns}
      data={filteredData}
      search={tableSearch}
      setSearch={setTableSearch}
      initialState={initialState}
      onExpand={handleExpand}
      getFolderHref={buildCollectionUrl}
      path={collectionPath}
      isTree={schema.view?.layout === "tree"}
      primaryField={primaryField}
    />
  );

  return <div className="min-w-0 flex flex-col space-y-6">{contentNode}</div>;
}
