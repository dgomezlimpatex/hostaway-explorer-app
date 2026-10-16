import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// Generate the real styles locally: the protected queue runs tests before Vite build.
export async function laundryRouteTestStyles() {
  const result = await postcss([tailwindcss('./tailwind.config.ts')]).process(
    readFileSync('src/index.css', 'utf8'), { from: 'src/index.css' },
  );
  // External font imports are intentionally unavailable in the offline fixture.
  result.root.walkAtRules('import', rule => rule.remove());
  return result.root.toString();
}
