"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpRight, Check, ChevronsUpDown, Languages, Plus } from "lucide-react";

type TranslationMenuProps = {
  branch: string;
  contextType: "collection" | "file";
  currentLocale: string;
  existingLocales?: string[];
  loading?: boolean;
  localeOptions: Array<{ code: string; label: string }>;
  missingLocales?: string[];
  name: string;
  onOpenChange?: (open: boolean) => void;
  owner: string;
  path: string;
  repo: string;
  siblings: Record<string, string>;
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  iconOnly?: boolean;
};

export function TranslationMenu({
  branch,
  contextType,
  currentLocale,
  existingLocales = [],
  loading = false,
  localeOptions,
  missingLocales = [],
  name,
  onOpenChange,
  owner,
  path,
  repo,
  siblings,
  size = "sm",
  variant = "outline",
  iconOnly = false,
}: TranslationMenuProps) {
  const labelByCode = Object.fromEntries(localeOptions.map((locale) => [locale.code, locale.label]));
  const getEditHref = (targetPath: string) =>
    contextType === "file"
      ? `/${owner}/${repo}/${encodeURIComponent(branch)}/file/${encodeURIComponent(name)}?path=${encodeURIComponent(targetPath)}`
      : `/${owner}/${repo}/${encodeURIComponent(branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(targetPath)}`;
  const getCreateHref = (targetPath: string) => {
    const params = new URLSearchParams({
      parent: targetPath.split("/").slice(0, -1).join("/"),
      target: targetPath,
      locale: Object.entries(siblings).find(([, siblingPath]) => siblingPath === targetPath)?.[0] ?? "",
      source: path,
    });
    return contextType === "file"
      ? `/${owner}/${repo}/${encodeURIComponent(branch)}/file/${encodeURIComponent(name)}?${params.toString()}`
      : `/${owner}/${repo}/${encodeURIComponent(branch)}/collection/${encodeURIComponent(name)}/new?${params.toString()}`;
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size === "sm" ? "sm" : "default"}
        >
          <Languages className="size-4" />
          {!iconOnly && <span>Translations</span>}
          {!iconOnly && <ChevronsUpDown className="size-4 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {loading ? (
          <DropdownMenuItem disabled>Loading translations...</DropdownMenuItem>
        ) : (
        <>
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          Translations
        </DropdownMenuLabel>
        {existingLocales.map((locale) => (
          locale === currentLocale ? (
            <DropdownMenuItem key={locale} disabled>
              <span>{labelByCode[locale] ?? locale}</span>
              <Check className="ml-auto size-4" />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={locale} asChild>
              <Link
                href={getEditHref(siblings[locale])}
                target="_blank"
                rel="noreferrer"
                className="group"
              >
                <span>{labelByCode[locale] ?? locale}</span>
                <ArrowUpRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" />
              </Link>
            </DropdownMenuItem>
          )
        ))}
        {existingLocales.length === 0 && (
          <DropdownMenuItem disabled>No translations yet</DropdownMenuItem>
        )}
        {missingLocales.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
              Add translations
            </DropdownMenuLabel>
            {missingLocales.map((locale) => (
              <DropdownMenuItem key={locale} asChild>
                <Link href={getCreateHref(siblings[locale])} className="group">
                  <span>{labelByCode[locale] ?? locale}</span>
                  {locale === currentLocale ? (
                    <Check className="ml-auto size-4" />
                  ) : (
                    <Plus className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
