// Load every row of a Supabase query, 1,000 at a time.
// Supabase returns at most 1,000 rows per request, so a plain select
// silently stops there. Pass a function that builds the query for a
// given row range; this keeps asking until a short page comes back.
//
//   const rows = await fetchAll((from, to) =>
//     supabase.from("shipping_orders").select("id, to_name").order("created_at").range(from, to)
//   );

export async function fetchAll<T = any>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
  max = 100000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message || "Couldn't load everything.");
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
