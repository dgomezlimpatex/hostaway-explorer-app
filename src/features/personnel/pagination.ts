type PageResult = { data: unknown[] | null; error: { message: string } | null };
export async function allPages<T>(
  fetchPage: (start: number, end: number) => PromiseLike<PageResult>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await fetchPage(offset, offset + 499);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data || []) as T[];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
