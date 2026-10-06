import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Exercise the real component's callbacks/hooks without DOM, network or services.
const folder = await mkdtemp(join(tmpdir(), "receipt-review-"));
try {
  const output = join(folder, "component.mjs");
  await build({
    entryPoints: ["src/components/inventory/LaundryReceiptReview.tsx"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    plugins: [
      {
        name: "local-react-harness",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(react|react\/jsx-runtime|lucide-react|@\/components\/ui\/(button|input))$/,
            },
            (args) => ({ path: args.path, namespace: "harness" }),
          );
          b.onLoad({ filter: /.*/, namespace: "harness" }, (args) => ({
            contents:
              args.path === "react"
                ? "export const useState=(value)=>globalThis.__receiptReviewHooks.useState(value);export const useEffect=(fn,deps)=>globalThis.__receiptReviewHooks.useEffect(fn,deps);"
                : args.path === "react/jsx-runtime"
                  ? 'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";'
                  : args.path === "lucide-react"
                    ? 'export const Pencil="svg";'
                    : args.path.endsWith("button")
                      ? 'export const Button="button";'
                      : 'export const Input="input";',
            loader: "js",
          }));
        },
      },
    ],
  });
  const { default: Review } = await import(pathToFileURL(output));
  let states = [],
    dependencies = [],
    stateIndex = 0,
    effectIndex = 0,
    effects = [],
    changed = false;
  globalThis.__receiptReviewHooks = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value) => {
          const next =
            typeof value === "function" ? value(states[index]) : value;
          if (!Object.is(next, states[index])) {
            states[index] = next;
            changed = true;
          }
        },
      ];
    },
    useEffect(fn, deps) {
      const index = effectIndex++;
      if (
        !dependencies[index] ||
        deps.some((value, i) => !Object.is(value, dependencies[index][i]))
      ) {
        dependencies[index] = deps;
        effects.push(fn);
      }
    },
  };
  const counts = {
    double_sheets: 200,
    single_sheets: 100,
    pillowcases: 400,
    bath_towels: 250,
    hand_towels: 220,
    bath_mats: 40,
    duvets: 12,
    mattress_protectors: 20,
    pillows: 30,
  };
  const corrections = [];
  const discardCorrections = [];
  let confirmations = 0,
    back = 0;
  let props = {
    counts,
    discardedCounts: Object.fromEntries(Object.keys(counts).map((k) => [k, 0])),
    onCorrectDiscard: (...args) => discardCorrections.push(args),
    revision: 5,
    notes: "Dos carros",
    locked: false,
    confirmed: false,
    updated: false,
    onCorrect: (...args) => corrections.push(args),
    onConfirm: () => confirmations++,
    onBack: () => back++,
  };
  let tree;
  function render() {
    for (let i = 0; i < 10; i++) {
      stateIndex = effectIndex = 0;
      effects = [];
      changed = false;
      tree = Review(props);
      for (const fn of effects) fn();
      if (!changed) return;
    }
    throw Error("Unstable review render");
  }
  function nodes(value = tree) {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap((x) => nodes(x ?? null));
    return [value, ...nodes(value.props?.children ?? null)];
  }
  function text(value) {
    if (value === null || value === undefined || typeof value === "boolean")
      return "";
    if (typeof value !== "object") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    return text(value.props?.children);
  }
  function button(name) {
    const result = nodes().find(
      (n) => n.type === "button" && (n.props["aria-label"] || text(n)) === name,
    );
    assert.ok(result, "Button " + name);
    return result;
  }
  function click(name) {
    const target = button(name);
    assert.equal(Boolean(target.props.disabled), false);
    target.props.onClick();
    render();
  }
  function fill(value) {
    nodes()
      .find((n) => n.type === "input")
      .props.onChange({ target: { value } });
    render();
  }
  render();
  assert.equal(nodes().filter((n) => n.type === "output").length, 18);
  assert.equal(
    nodes().filter(
      (n) =>
        n.type === "button" && n.props["aria-label"]?.startsWith("Editar "),
    ).length,
    18,
  );
  assert.equal(
    corrections.length + confirmations,
    0,
    "Opening review cannot save or send",
  );
  click("Editar Toallas de baño");
  for (const invalid of ["", "-5", "2.5", "1000000000"]) {
    fill(invalid);
    click("Guardar corrección");
    assert.equal(corrections.length, 0);
    assert.ok(text(tree).includes("cantidad entera"));
  }
  fill("270");
  assert.equal(
    button("Confirmar y enviar Excel").props.disabled,
    true,
    "Unsaved edits block confirmation",
  );
  click("Guardar corrección");
  assert.deepEqual(corrections, [["bath_towels", 270, 5]]);
  props = { ...props, counts: { ...counts, bath_towels: 270 }, revision: 6 };
  render();
  assert.equal(
    nodes().filter((n) => n.type === "input").length,
    0,
    "Successful saved correction closes editor",
  );
  click("Editar Almohadas");
  fill("50");
  props = { ...props, counts: { ...props.counts, pillows: 35 }, revision: 7 };
  render();
  assert.equal(button("Guardar corrección").props.disabled, true);
  assert.ok(text(tree).includes("recuento ha cambiado"));
  assert.equal(button("Confirmar y enviar Excel").props.disabled, true);
  click("Cancelar edición");
  click("Editar Almohadas");
  fill("50");
  click("Guardar corrección");
  assert.deepEqual(corrections[1], ["pillows", 50, 7]);
  props = { ...props, counts: { ...props.counts, pillows: 50 }, revision: 8 };
  render();
  click("Confirmar y enviar Excel");
  assert.equal(confirmations, 1);
  props = { ...props, locked: true };
  render();
  assert.equal(button("Guardando…").props.disabled, true);
  assert.equal(button("Volver al recuento").props.disabled, true);
  props = { ...props, locked: false, updated: true };
  render();
  assert.ok(button("Confirmar cambios y reenviar Excel"));
  click("Volver al recuento");
  assert.equal(back, 1);
  props = { ...props, confirmed: true };
  render();
  assert.ok(text(tree).includes("Recuento confirmado"));
  assert.equal(
    nodes().filter((n) => n.props?.["aria-label"]?.startsWith("Editar "))
      .length,
    18,
  );
  assert.equal(confirmations, 1, "Success view cannot send again");
  click("Editar Edredones");
  fill("10");
  click("Guardar corrección");
  assert.deepEqual(corrections[2], ["duvets", 10, 8]);
  assert.equal(
    confirmations,
    1,
    "Correcting a confirmed receipt does not resend automatically",
  );
  click("Cancelar edición");
  props = { ...props, confirmed: false };
  render();
  assert.equal(
    nodes().find((n) => n.type === "details").props.open,
    undefined,
    "Discards collapsed by default",
  );
  click("Editar descartes Almohadas");
  fill("4");
  assert.equal(
    button("Confirmar cambios y reenviar Excel").props.disabled,
    true,
  );
  click("Guardar corrección");
  assert.deepEqual(discardCorrections, [["pillows", 4, 8]]);
  props = {
    ...props,
    discardedCounts: { ...props.discardedCounts, pillows: 4 },
    revision: 9,
  };
  render();
  assert.equal(nodes().filter((n) => n.type === "input").length, 0);
  click("Editar descartes Almohadas");
  fill("3");
  props = { ...props, revision: 10 };
  render();
  assert.equal(
    button("Guardar corrección").props.disabled,
    true,
    "Stale discard correction blocked",
  );
  assert.equal(confirmations, 1, "Discard editing does not send");
  console.log(
    "Review: nine totals, no automatic writes/send, edits, validation, stale revision, pending work, confirmation, updated receipt and success view verified.",
  );
} finally {
  delete globalThis.__receiptReviewHooks;
  await rm(folder, { recursive: true, force: true });
}
