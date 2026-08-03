/**
 * Smoke T23: upload sede/sala con Multer+Sharp
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.PORT ?? "4000";
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-secret-16";

/** PNG 1x1 mínimo válido */
function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function main() {
  const email = `upload+${Date.now()}@test.local`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Upload Owner",
      email,
      password: "testpass123",
      businessName: `Upload Studio ${Date.now()}`,
      zona: "Palermo",
    }),
  });
  if (!reg.ok) throw new Error(`register ${reg.status}`);
  const { user, tenant } = (await reg.json()) as {
    user: { id: string };
    tenant: { id: string };
  };

  const headers = {
    "x-internal-secret": SECRET,
    "x-user-id": user.id,
    "x-tenant-id": tenant.id,
  };

  const salaRes = await fetch(`${BASE}/salas`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Sala Upload",
      categoria: "Música",
      precioHora: "4000.00",
      capacity: 4,
    }),
  });
  if (!salaRes.ok) throw new Error(`sala ${salaRes.status}`);
  const sala = (await salaRes.json()) as { id: string };

  const fdSede = new FormData();
  fdSede.append(
    "file",
    new Blob([tinyPng()], { type: "image/png" }),
    "sede.png",
  );
  const upSede = await fetch(`${BASE}/uploads/sede`, {
    method: "POST",
    headers,
    body: fdSede,
  });
  if (!upSede.ok) {
    throw new Error(`upload sede ${upSede.status} ${await upSede.text()}`);
  }
  const sedeBody = (await upSede.json()) as { photoUrl: string };
  if (!sedeBody.photoUrl.includes("/media/")) {
    throw new Error(`photoUrl ${sedeBody.photoUrl}`);
  }
  console.log("OK sede upload", sedeBody.photoUrl);

  const media = await fetch(sedeBody.photoUrl);
  if (!media.ok) throw new Error(`media ${media.status}`);
  const ctype = media.headers.get("content-type") ?? "";
  if (!ctype.includes("image")) {
    throw new Error(`content-type ${ctype}`);
  }
  console.log("OK media serve", ctype);

  const fdSala = new FormData();
  fdSala.append(
    "files",
    new Blob([tinyPng()], { type: "image/png" }),
    "a.png",
  );
  fdSala.append(
    "files",
    new Blob([tinyPng()], { type: "image/png" }),
    "b.png",
  );
  const upSala = await fetch(`${BASE}/uploads/salas/${sala.id}`, {
    method: "POST",
    headers,
    body: fdSala,
  });
  if (!upSala.ok) {
    throw new Error(`upload sala ${upSala.status} ${await upSala.text()}`);
  }
  const salaBody = (await upSala.json()) as {
    photos: string[];
    added: string[];
  };
  if (salaBody.added.length !== 2) {
    throw new Error(`added ${JSON.stringify(salaBody)}`);
  }
  if (!salaBody.photos[0]?.includes(`/salas/${sala.id}/`)) {
    throw new Error(`path org ${salaBody.photos[0]}`);
  }
  console.log("OK sala uploads", salaBody.photos.length);

  const del = await fetch(`${BASE}/uploads/salas/${sala.id}/photo`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ url: salaBody.photos[0] }),
  });
  if (!del.ok) throw new Error(`delete ${del.status}`);
  const delBody = (await del.json()) as { photos: string[] };
  if (delBody.photos.length !== 1) {
    throw new Error(`after delete ${JSON.stringify(delBody)}`);
  }
  console.log("OK delete photo");

  console.log("PASS smoke-t23");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
