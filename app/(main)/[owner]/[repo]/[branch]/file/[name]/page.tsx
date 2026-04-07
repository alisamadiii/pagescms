"use client";

import { use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useConfig } from "@/contexts/config-context";
import { Entry } from "@/components/entry/entry";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { getSchemaByName } from "@/lib/schema";

export default function Page({
  params
}: {
  params: Promise<{
    owner: string;
    repo: string;
    branch: string;
    name: string;
  }>
}) {
  const resolvedParams = use(params);
  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);
  const searchParams = useSearchParams();
  
  const schema = useMemo(() => getSchemaByName(config?.object, decodeURIComponent(resolvedParams.name)), [config, resolvedParams.name]);
  if (!schema) throw new Error(`Schema not found for ${decodeURIComponent(resolvedParams.name)}.`);
  const overridePath = searchParams.get("path") || undefined;
  const locale = searchParams.get("locale") || undefined;
  const source = searchParams.get("source") || undefined;
  const target = searchParams.get("target") || undefined;
  
  return (
    <>
      <DocumentTitle
        title={formatRepoBranchTitle(schema.label || schema.name, config.owner, config.repo, config.branch)}
      />
      <Entry
        name={resolvedParams.name}
        path={target ? undefined : (overridePath || schema.path)}
        sourcePath={source}
        targetPath={target}
        targetLocale={locale}
        title={schema.label || schema.name}
      />
    </>
  );
}
