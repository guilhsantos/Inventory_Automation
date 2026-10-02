// =============================================================================
// Comprime as fotos do bucket "order-photos" no mesmo endereço (os links do app
// continuam valendo). Uso ÚNICO, rodado no computador do administrador.
//
// Usa a chave service_role SÓ neste script local (nunca no código do app).
// Passe as credenciais pelo terminal; não salve a chave em arquivo do projeto.
//
//   PowerShell:
//     $env:SUPABASE_URL="https://xxxx.supabase.co"
//     $env:SUPABASE_SERVICE_ROLE_KEY="..."
//     node scripts/comprimir-fotos.mjs            # simulação: só mostra a economia
//     node scripts/comprimir-fotos.mjs --aplicar  # comprime e substitui
//
// Antes de substituir, cada original é salvo em ./backup-fotos/<nome>.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const BUCKET = "order-photos";
const MAX_LADO = 1920; // mesmo padrão da compressão feita no app (src/lib/image.ts)
const QUALIDADE = 80;
const MIN_BYTES = 700 * 1024; // fotos menores que isso já estão comprimidas
const PASTA_BACKUP = path.resolve("backup-fotos");

const aplicar = process.argv.includes("--aplicar");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no terminal antes de rodar.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const mb = (b) => (b / 1024 / 1024).toFixed(2) + " MB";

async function listarTodos() {
  const todos = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    todos.push(...data.filter((o) => o.id)); // ignora "pastas"
    if (data.length < 1000) return todos;
  }
}

async function existe(arquivo) {
  try {
    await access(arquivo);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(aplicar ? "MODO APLICAR: as fotos serão substituídas.\n" : "SIMULAÇÃO: nada será alterado (use --aplicar).\n");
  await mkdir(PASTA_BACKUP, { recursive: true });

  const objetos = await listarTodos();
  const total = objetos.reduce((s, o) => s + (o.metadata?.size ?? 0), 0);
  const grandes = objetos.filter((o) => (o.metadata?.size ?? 0) >= MIN_BYTES);
  console.log(`${objetos.length} fotos, ${mb(total)} no total; ${grandes.length} acima de ${mb(MIN_BYTES)}.\n`);

  let antes = 0;
  let depois = 0;
  let falhas = 0;

  for (const [i, obj] of grandes.entries()) {
    const nome = obj.name;
    const prefixo = `[${i + 1}/${grandes.length}] ${nome}`;
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(nome);
      if (error) throw error;
      const original = Buffer.from(await blob.arrayBuffer());

      const comprimida = await sharp(original, { failOn: "none" })
        .rotate() // aplica a rotação da câmera (EXIF) antes de remover os metadados
        .resize({ width: MAX_LADO, height: MAX_LADO, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALIDADE, mozjpeg: true })
        .toBuffer();

      if (comprimida.length >= original.length) {
        console.log(`${prefixo}: já está otimizada, mantida`);
        continue;
      }

      antes += original.length;
      depois += comprimida.length;
      console.log(`${prefixo}: ${mb(original.length)} -> ${mb(comprimida.length)}`);

      if (aplicar) {
        const backup = path.join(PASTA_BACKUP, nome);
        if (!(await existe(backup))) await writeFile(backup, original);

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(nome, comprimida, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
        if (upErr) throw upErr;
      }
    } catch (err) {
      falhas++;
      console.error(`${prefixo}: ERRO ${err.message ?? err}`);
    }
  }

  const economia = antes - depois;
  console.log("\n================ RESUMO ================");
  console.log(`Fotos comprimidas: ${grandes.length - falhas} | falhas: ${falhas}`);
  console.log(`Antes: ${mb(antes)} -> depois: ${mb(depois)} (economia de ${mb(economia)})`);
  console.log(`Bucket estimado após: ${mb(total - economia)}`);
  if (aplicar) console.log(`Originais salvos em: ${PASTA_BACKUP}`);
  else console.log("Nada foi alterado. Rode com --aplicar para substituir.");
}

main().catch((err) => {
  console.error("Falhou:", err.message ?? err);
  process.exit(1);
});
