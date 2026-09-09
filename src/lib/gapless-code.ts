import { SupabaseClient } from "@supabase/supabase-js";

export async function generateGaplessCode(
  supabase: SupabaseClient<any, "public", any>,
  table: string,
  codeColumn: string,
  puskesmasId: string
): Promise<string> {
  const { data: pusk } = await supabase
    .from("puskesmas")
    .select("kode")
    .eq("id", puskesmasId)
    .single();
    
  const prefix = pusk?.kode || "UNK";

  const { data: rows } = await supabase
    .from(table)
    .select(codeColumn)
    .eq("puskesmas_id", puskesmasId)
    .is("deleted_at", null);

  const codes = (rows || [])
    .map((r: any) => r[codeColumn] as string)
    .filter(c => c && c.startsWith(prefix + "-") && !c.startsWith("DEL"));
  const nums = codes
    .map((c) => parseInt(c.slice(prefix.length + 1), 10))
    .filter((n) => !isNaN(n));

  // Nomor resmi selalu melanjutkan nomor terbesar yang pernah dipakai.
  // Draft dan DEL tidak ikut dihitung, sehingga draft tidak membuat nomor lompat.
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;

  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}
