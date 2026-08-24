import { cache } from "react";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/** Server Component / Server Action Supabase client. Do not use in browser code. */
export async function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where cookies cannot be set.
            // Session refresh is handled by the proxy instead.
          }
        },
      },
    }
  );
}

/**
 * Utilizador autenticado + perfil (id, role, club_id), memorizado com cache() do React
 * para o pedido actual. Sem isto, cada Server Action com o seu próprio getAuthContext()
 * privado repetia auth.getUser() + SELECT profiles de forma independente — numa única
 * página como /agenda, page.tsx + getCurrentSeason() + getSessionsForClub() chamavam
 * isto 3 vezes em série, cada uma a pagar round-trip completo ao Supabase. cache()
 * garante que, dentro do mesmo pedido, chamadas repetidas devolvem a mesma promise já
 * resolvida em vez de repetir o fetch.
 */
export const getRequestUser = cache(async () => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, club_id")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
});
