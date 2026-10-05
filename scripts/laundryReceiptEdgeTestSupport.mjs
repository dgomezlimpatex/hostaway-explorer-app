import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
export async function loadReceiptEdge(t) {
  const output = join(
    await mkdtemp(join(tmpdir(), "receipt-edge-test-")),
    "edge.mjs",
  );
  await build({
    entryPoints: ["supabase/functions/laundry-receipts/index.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    plugins: [
      {
        name: "isolated-edge",
        setup(b) {
          b.onResolve(
            { filter: /^(npm:|https:\/\/esm.sh\/)@supabase\/supabase-js/ },
            () => ({ path: "supabase-fixture", namespace: "fixture" }),
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export const createClient = () => globalThis.__receiptTestClient;",
            loader: "js",
          }));
          b.onResolve({ filter: /^npm:xlsx/ }, () => ({
            path: require.resolve("xlsx/xlsx.mjs"),
          }));
        },
      },
    ],
  });
  const queries = [];
  function from(table) {
    const filters = [];
    let mutation = null,
      single = false,
      limit = Infinity,
      ordering = null;
    const api = {
      select() {
        return api;
      },
      eq(key, value) {
        filters.push({ key, value, op: "eq" });
        return api;
      },
      in(key, value) {
        filters.push({ key, value, op: "in" });
        return api;
      },
      is(key, value) {
        filters.push({ key, value, op: "eq" });
        return api;
      },
      update(values) {
        mutation = values;
        return api;
      },
      order(key, options) {
        ordering = { key, asc: options?.ascending !== false };
        return api;
      },
      limit(n) {
        limit = n;
        return api;
      },
      single() {
        single = true;
        return api;
      },
      maybeSingle() {
        single = true;
        return api;
      },
      async then(resolve, reject) {
        try {
          queries.push({ table, mutation });
          let rows;
          if (table === "user_roles")
            rows = [{ user_id: "fixture-admin", role: "admin" }];
          else if (table === "user_sede_access")
            rows = [
              {
                user_id: "fixture-admin",
                sede_id: (
                  await t.db.query(
                    "SELECT sede_id FROM stock_warehouses WHERE id=$1",
                    [t.warehouse],
                  )
                ).rows[0].sede_id,
                can_access: true,
              },
            ];
          else rows = (await t.db.query(`SELECT * FROM public.${table}`)).rows;
          if (table === "laundry_route_workers") {
            for (const row of rows)
              row.cleaners = (
                await t.db.query("SELECT * FROM cleaners WHERE id=$1", [
                  row.cleaner_id,
                ])
              ).rows[0];
          }
          rows = rows.filter((row) =>
            filters.every(({ key, value, op }) => {
              const actual = key.split(".").reduce((o, k) => o?.[k], row);
              return op === "in" ? value.includes(actual) : actual === value;
            }),
          );
          if (ordering)
            rows.sort(
              (a, b) =>
                (a[ordering.key] > b[ordering.key] ? 1 : -1) *
                (ordering.asc ? 1 : -1),
            );
          rows = rows.slice(0, limit);
          if (mutation)
            for (const row of rows) {
              const entries = Object.entries(mutation),
                args = entries.map(([, v]) => v);
              await t.db.query(
                `UPDATE public.${table} SET ${entries.map(([key], i) => `${key}=$${i + 1}`).join(",")} WHERE id=$${args.length + 1}`,
                [...args, row.id],
              );
              Object.assign(row, mutation);
            }
          if (table === "laundry_receipt_versions")
            for (const row of rows)
              row.email = (
                await t.db.query(
                  "SELECT * FROM laundry_receipt_emails WHERE version_id=$1",
                  [row.id],
                )
              ).rows;
          return resolve({
            data: single ? (rows[0] ?? null) : rows,
            error: null,
          });
        } catch (error) {
          return resolve({ data: null, error });
        }
      },
    };
    return api;
  }
  globalThis.__receiptTestClient = {
    from,
    auth: {
      async getUser(jwt) {
        return jwt === "fixture-admin-jwt"
          ? { data: { user: { id: "fixture-admin" } }, error: null }
          : { data: { user: null }, error: new Error("invalid") };
      },
    },
    async rpc(name, args) {
      try {
        return { data: await t.rpc(name, args), error: null };
      } catch (err) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    },
  };
  globalThis.Deno = {
    env: {
      get(name) {
        return {
          SUPABASE_URL: "https://fixture.invalid",
          SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
          RESEND_API_KEY: "fixture-resend-key",
        }[name];
      },
    },
    serve() {},
  };
  const module = await import(pathToFileURL(output).href);
  async function request(
    body,
    authorization = "Bearer fixture-anon",
    ip = "127.0.0.1",
  ) {
    const response = await module.handleReceiptRequest(
      new Request("https://fixture.invalid/functions/v1/laundry-receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
          "x-forwarded-for": ip,
        },
        body: JSON.stringify(body),
      }),
    );
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
    return { status: response.status, data };
  }
  return { request, queries };
}
