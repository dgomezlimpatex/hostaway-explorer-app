
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuración Hostaway
const HOSTAWAY_ACCOUNT_ID = 80687;
const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

interface HostawayProperty {
  id: number;
  internalName: string;
  listingMapId: number;
  address?: string;
  city?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getHostawayToken(): Promise<string> {
  console.log('Obteniendo token de Hostaway...');
  
  const clientId = Deno.env.get('HOSTAWAY_CLIENT_ID');
  const clientSecret = Deno.env.get('HOSTAWAY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Hostaway no configuradas');
  }

  const response = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'general',
    }),
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchHostawayProperties(token: string): Promise<HostawayProperty[]> {
  console.log('Obteniendo propiedades de Hostaway...');
  
  const url = new URL(`${HOSTAWAY_API_BASE}/listings`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  url.searchParams.append('limit', '100');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo propiedades: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando inserción de propiedades desde Hostaway...');

    // Verificar si ya existe el cliente Blue Ocean Properties
    let { data: existingClient } = await supabase
      .from('clients')
      .select('*')
      .eq('nombre', 'Blue Ocean Properties')
      .single();

    let clientId: string;

    if (!existingClient) {
      console.log('Creando cliente Blue Ocean Properties...');
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          nombre: 'Blue Ocean Properties',
          email: 'info@blueoceanproperties.com',
          telefono: '+34900000000',
          direccion_facturacion: 'Calle Principal, 123, Madrid',
          cif_nif: 'B12345678',
          tipo_servicio: 'Limpieza Airbnb',
          metodo_pago: 'Transferencia',
          supervisor: 'Administrador',
          factura: true,
          ciudad: 'Madrid',
          codigo_postal: '28001'
        })
        .select()
        .single();

      if (clientError) {
        console.error('Error creando cliente:', clientError);
        throw clientError;
      }

      clientId = newClient.id;
      console.log('Cliente creado con ID:', clientId);
    } else {
      clientId = existingClient.id;
      console.log('Cliente existente encontrado con ID:', clientId);
    }

    // Obtener propiedades de Hostaway
    const token = await getHostawayToken();
    const hostawayProperties = await fetchHostawayProperties(token);
    
    console.log(`Obtenidas ${hostawayProperties.length} propiedades de Hostaway`);

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const property of hostawayProperties) {
      try {
        // Verificar si la propiedad ya existe por hostaway_listing_id
        const { data: existingProperty } = await supabase
          .from('properties')
          .select('*')
          .eq('hostaway_listing_id', property.listingMapId)
          .single();

        const propertyData = {
          cliente_id: clientId,
          nombre: property.internalName || `Propiedad ${property.listingMapId}`,
          codigo: `HOST_${property.listingMapId}`,
          direccion: property.address || `Dirección de ${property.internalName}`,
          numero_camas: 1,
          numero_banos: 1,
          numero_sabanas: 2,
          numero_fundas_almohada: 2,
          numero_toallas_pequenas: 2,
          numero_toallas_grandes: 2,
          numero_alfombrines: 1,
          duracion_servicio: 60,
          coste_servicio: 50.00,
          check_in_predeterminado: '15:00:00',
          check_out_predeterminado: '11:00:00',
          hostaway_listing_id: property.listingMapId,
          hostaway_internal_name: property.internalName,
          notas: `Propiedad importada de Hostaway. Listing Map ID: ${property.listingMapId}`
        };

        if (existingProperty) {
          // Actualizar propiedad existente
          const { error: updateError } = await supabase
            .from('properties')
            .update({
              ...propertyData,
              fecha_actualizacion: new Date().toISOString().split('T')[0]
            })
            .eq('id', existingProperty.id);

          if (updateError) {
            console.error(`Error actualizando propiedad ${property.listingMapId}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ Propiedad actualizada: ${property.internalName} (ID: ${property.listingMapId})`);
            updatedCount++;
          }
        } else {
          // Insertar nueva propiedad
          const { error: insertError } = await supabase
            .from('properties')
            .insert(propertyData);

          if (insertError) {
            console.error(`Error insertando propiedad ${property.listingMapId}:`, insertError);
            errorCount++;
          } else {
            console.log(`✅ Propiedad insertada: ${property.internalName} (ID: ${property.listingMapId})`);
            insertedCount++;
          }
        }
      } catch (error) {
        console.error(`Error procesando propiedad ${property.listingMapId}:`, error);
        errorCount++;
      }
    }

    const summary = {
      success: true,
      message: `Proceso completado: ${insertedCount} propiedades insertadas, ${updatedCount} actualizadas, ${errorCount} errores`,
      details: {
        total_properties: hostawayProperties.length,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
        client_id: clientId
      }
    };

    console.log('Resumen final:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error en inserción de propiedades:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
