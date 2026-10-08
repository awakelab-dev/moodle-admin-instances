export interface ManifestOptions {
  title: string;
  identifier: string;
  version: string;
  entryPoint: string;
  /** Lista completa de arquivos do pacote (além do entryPoint) */
  resourceFiles?: string[];
}

export function buildManifest(options: ManifestOptions): string {
  const { title, identifier, version, entryPoint, resourceFiles = [] } = options;

  // Garante que o entryPoint aparece primeiro e sem duplicatas
  const allFiles = [entryPoint, ...resourceFiles.filter(f => f !== entryPoint)];
  const fileEntries = allFiles.map(f => `      <file href="${f}"/>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="${version}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="ORG-${identifier}">
    <organization identifier="ORG-${identifier}">
      <title>${title}</title>
      <item identifier="ITEM-${identifier}" identifierref="RES-${identifier}">
        <title>${title}</title>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES-${identifier}" type="webcontent"
              adlcp:scormtype="sco" href="${entryPoint}">
${fileEntries}
    </resource>
  </resources>

</manifest>`;
}
