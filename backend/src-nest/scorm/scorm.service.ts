import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Response } from 'express';
import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicUser } from '../auth/auth.service';
import { optimizePackage } from './scorm-optimizer';

interface ZipEntryFile {
  path: string;
  data: Buffer;
}

// Mapeo mínimo extensión → Content-Type — sin esto S3 sirve todo como
// application/octet-stream y el navegador fuerza la descarga en vez de
// renderizar el HTML/CSS/JS del paquete SCORM dentro del iframe.
const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  pdf: 'application/pdf',
};

function mimeFor(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

// Localiza, dentro de un ZIP (soporta un nivel de ZIP anidado dentro del
// ZIP, común en paquetes SCORM exportados por algunas herramientas de
// autor), la raíz real del curso — la carpeta que contiene imsmanifest.xml
// — y devuelve todos sus archivos ya descomprimidos en memoria.
function extractScormRoot(buffer: Buffer, depth = 0): ZipEntryFile[] | null {
  if (depth > 4) return null;
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return null;
  }

  const entries = zip.getEntries();
  const hasManifest = entries.some((e) => !e.isDirectory && e.entryName.toLowerCase().includes('imsmanifest.xml'));

  if (hasManifest) {
    const files: ZipEntryFile[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const ext = entry.entryName.split('.').pop()?.toLowerCase() ?? '';
      if (ext === 'zip' || ext === 'scorm') continue;
      // Protección zip-slip: una entrada con ".." no debería poder escribirse
      // fuera del prefijo del paquete en S3.
      if (entry.entryName.includes('..')) continue;
      files.push({ path: entry.entryName, data: entry.getData() });
    }
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = entry.entryName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'zip' || ext === 'scorm') {
      const inner = extractScormRoot(entry.getData(), depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

// Misma heurística que el "SCORM Lab" original (SCORM-Suite): primero
// intenta leer el SCO declarado en imsmanifest.xml (varias estrategias de
// regex, porque el XML real varía bastante entre herramientas de autor),
// y si no lo encuentra cae a buscar un index.html o cualquier .html.
function findEntryPoint(files: ZipEntryFile[]): string | null {
  const manifest = files.find((f) => f.path.toLowerCase().endsWith('imsmanifest.xml'));
  if (manifest) {
    const xml = manifest.data.toString('utf-8');
    const manifestDir = manifest.path.includes('/') ? manifest.path.slice(0, manifest.path.lastIndexOf('/') + 1) : '';
    const rel = parseManifestEntry(xml);
    if (rel) return manifestDir + rel;
  }
  const index = files.find((f) => /(^|\/)index\.html?$/i.test(f.path));
  if (index) return index.path;
  const anyHtml = files.find((f) => /\.html?$/i.test(f.path));
  return anyHtml?.path ?? null;
}

function parseManifestEntry(xml: string): string | null {
  const scoPatterns = [
    /adlcp:scormtype\s*=\s*["']sco["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /href\s*=\s*["']([^"'?#]+)["'][^>]*adlcp:scormtype\s*=\s*["']sco["']/i,
  ];
  for (const pat of scoPatterns) {
    const m = xml.match(pat);
    if (m?.[1] && !m[1].startsWith('http')) return m[1];
  }
  const defOrgMatch = xml.match(/organizations\s[^>]*default\s*=\s*["']([^"']+)["']/i);
  if (defOrgMatch) {
    const orgId = defOrgMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const orgBlock = xml.match(new RegExp(`identifier\\s*=\\s*["']${orgId}["'][\\s\\S]*?</organization>`, 'i'));
    if (orgBlock) {
      const itemRef = orgBlock[0].match(/identifierref\s*=\s*["']([^"']+)["']/i);
      if (itemRef) {
        const resId = itemRef[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resBlock = xml.match(new RegExp(`identifier\\s*=\\s*["']${resId}["'][^>]*href\\s*=\\s*["']([^"']+)["']`, 'i'));
        if (resBlock?.[1] && !resBlock[1].startsWith('http')) return resBlock[1];
      }
    }
  }
  const hrefHtml = xml.match(/href\s*=\s*["']([^"'?#]*\.html?[^"']*)["']/i);
  if (hrefHtml && !hrefHtml[1].startsWith('http')) return hrefHtml[1];
  const anyHref = xml.match(/href\s*=\s*["']([^"']+)["']/i);
  if (anyHref && !anyHref[1].startsWith('http')) return anyHref[1];
  return null;
}

@Injectable()
export class ScormService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private prisma: PrismaService) {
    this.region = process.env.AWS_REGION || 'eu-west-1';
    this.bucket = process.env.AWS_S3_BUCKET || '';
    this.s3 = new S3Client({ region: this.region });
  }

  // Ruta relativa (bajo /api) servida por este mismo backend — el bucket es
  // privado (igual que el resto de buckets S3 de la organización, según
  // feedback del arquitecto de AWS), así que el navegador nunca habla con
  // S3 directamente: todo pasa por este proxy, que sí tiene credenciales
  // IAM para leer el objeto.
  contentPathFor(id: string, relativePath: string): string {
    return `scorm/content/${id}/${relativePath}`;
  }

  async listPackages() {
    const packages = await this.prisma.scormPackage.findMany({ orderBy: { createdAt: 'desc' } });
    return packages.map((p) => ({
      id: p.id,
      name: p.name,
      originalFilename: p.originalFilename,
      sizeBytes: p.sizeBytes.toString(),
      uploadedByUsername: p.uploadedByUsername,
      createdAt: p.createdAt,
      entryPath: this.contentPathFor(p.id, p.entryPoint),
    }));
  }

  // Sirve un archivo del paquete leyéndolo de S3 (bucket privado) y
  // haciendo streaming directo a la respuesta — ni el bucket ni el objeto
  // necesitan ser públicos para esto.
  async streamContent(id: string, relativePath: string, res: Response) {
    const pkg = await this.prisma.scormPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Paquete SCORM no encontrado.');

    // Protección zip-slip también aquí: un "../" en la ruta pedida no debe
    // poder escapar del prefijo del paquete.
    const safePath = relativePath.replace(/^\/+/, '');
    if (safePath.includes('..')) throw new BadRequestException('Ruta inválida.');

    let obj;
    try {
      obj = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: pkg.s3Prefix + safePath }));
    } catch (err) {
      throw new NotFoundException(`Archivo no encontrado en el paquete: ${safePath}`);
    }

    res.setHeader('Content-Type', obj.ContentType || mimeFor(safePath));
    if (obj.ContentLength) res.setHeader('Content-Length', String(obj.ContentLength));
    const body = obj.Body as NodeJS.ReadableStream;
    body.pipe(res);
  }

  async uploadPackage(file: Express.Multer.File, name: string, optimize: boolean, currentUser: PublicUser) {
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'AWS_S3_BUCKET no está configurado en el backend — pide el nombre del bucket a quien lo haya creado.',
      );
    }
    if (!file) throw new BadRequestException('Falta el archivo ZIP del paquete SCORM.');

    let files = extractScormRoot(file.buffer);
    if (!files || !files.length) {
      throw new BadRequestException('No se encontró un paquete SCORM válido dentro del ZIP (falta imsmanifest.xml).');
    }

    let optimizeReport = null;
    if (optimize) {
      const result = await optimizePackage(files);
      files = result.files;
      optimizeReport = result.report;
    }

    const entryPoint = findEntryPoint(files);
    if (!entryPoint) {
      throw new BadRequestException('No se encontró ningún punto de entrada (HTML) dentro del paquete SCORM.');
    }

    const id = randomUUID();
    const s3Prefix = `scorm/${id}/`;
    let totalSize = 0;

    try {
      for (const f of files) {
        totalSize += f.data.length;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Prefix + f.path,
            Body: f.data,
            ContentType: mimeFor(f.path),
          }),
        );
      }
    } catch (err) {
      throw new InternalServerErrorException(`Fallo subiendo a S3: ${(err as Error).message}`);
    }

    const created = await this.prisma.scormPackage.create({
      data: {
        name: name?.trim() || file.originalname.replace(/\.zip$/i, ''),
        originalFilename: file.originalname,
        s3Prefix,
        entryPoint,
        sizeBytes: BigInt(totalSize),
        uploadedByUserId: currentUser?.id ?? null,
        uploadedByUsername: currentUser?.username ?? 'desconocido',
      },
    });

    return {
      id: created.id,
      name: created.name,
      entryPath: this.contentPathFor(created.id, entryPoint),
      optimizeReport,
    };
  }

  async deletePackage(id: string) {
    const pkg = await this.prisma.scormPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Paquete SCORM no encontrado.');

    // Borra todos los objetos bajo ese prefijo (puede ser más de 1000 si el
    // paquete es muy grande, de ahí el bucle paginado con ContinuationToken).
    let continuationToken: string | undefined;
    do {
      const listed = await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: pkg.s3Prefix, ContinuationToken: continuationToken }),
      );
      const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
      if (keys.length) {
        await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }));
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    await this.prisma.scormPackage.delete({ where: { id } });
    return { message: 'Paquete SCORM eliminado.' };
  }
}
