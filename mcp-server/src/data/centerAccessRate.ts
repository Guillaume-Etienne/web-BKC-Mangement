import { supabase } from '../supabaseClient.js'

/** The center access price configured in the app (`price_items`), or null when none
 *  is set: the caller then leaves the column out and the database default applies.
 *  Same source as the booking wizard, so a price change reaches every creation path. */
export async function configuredCenterAccessRate(): Promise<number | null> {
  const { data, error } = await supabase
    .from('price_items').select('price').eq('billable_type', 'center_access').limit(1).maybeSingle()
  if (error) throw new Error(`Loading the center access price: ${error.message}`)
  return data?.price ?? null
}
