
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Función para convertir duración de "HH:MM:SS" a minutos
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

const properties = [
  { nombre: "Blue Ocean Apartment", codigo: "RMA44.2C", direccion: "Ronda de Monte Alto 44, 2ºC", coste: 66.0, duracion: "2:00:00" },
  { nombre: "Blue Ocean Penthouse", codigo: "RMA44.7D", direccion: "Ronda de Monte Alto 44, 7º", coste: 107.0, duracion: "3:30:00" },
  { nombre: "Blue Ocean Portonovo Apartment 2ºD", codigo: "PORTONOVO.2D", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 92.0, duracion: "2:15:00" },
  { nombre: "Blue Ocean Portonovo Apartment 2ºI", codigo: "PORTONOVO.2I", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 92.0, duracion: "2:15:00" },
  { nombre: "Blue Ocean Portonovo Apartment 3ºD", codigo: "PORTONOVO.3D", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 92.0, duracion: "2:15:00" },
  { nombre: "Blue Ocean Portonovo Apartment 3ºI", codigo: "PORTONOVO.3I", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 92.0, duracion: "2:15:00" },
  { nombre: "Blue Ocean Portonovo Apartment 4ºD", codigo: "PORTONOVO.4D", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 92.0, duracion: "2:15:00" },
  { nombre: "Blue Ocean Portonovo Apartment 4ºI", codigo: "PORTONOVO.4I", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 92.0, duracion: "2:15:00" },
  { nombre: "Blue Ocean Portonovo Studio 1ºD", codigo: "PORTONOVO.1D", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 53.0, duracion: "1:15:00" },
  { nombre: "Blue Ocean Portonovo Studio 1ºI", codigo: "PORTONOVO.1I", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 53.0, duracion: "1:15:00" },
  { nombre: "Blue Ocean Portonovo Terrace Penthouse", codigo: "PORTONOVO.5", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 145.0, duracion: "4:00:00" },
  { nombre: "Blue Ocean Portonovo Terrace Rooftop D", codigo: "PORTONOVO.6D", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 60.0, duracion: "1:30:00" },
  { nombre: "Blue Ocean Portonovo Terrace Rooftop I", codigo: "PORTONOVO.6I", direccion: "Av. de Pontevedra, 18 Sanxenxo", coste: 60.0, duracion: "1:30:00" },
  { nombre: "Central Hideaway Apartment", codigo: "CDA10.1", direccion: "Campo de Artillería,10, 1º", coste: 70.0, duracion: "2:15:00" },
  { nombre: "Central Hideaway Penthouse", codigo: "CDA10.4", direccion: "Campo de Artillería, 10", coste: 70.0, duracion: "2:15:00" },
  { nombre: "Central Square Deluxe Apartment", codigo: "CF41", direccion: "Calle Franja 41, 3º", coste: 70.0, duracion: "2:00:00" },
  { nombre: "Downtown La Torre 1", codigo: "LT34.1", direccion: "Calle La Torre 34", coste: 74.0, duracion: "2:15:00" },
  { nombre: "Downtown La Torre 2", codigo: "LT34.2", direccion: "Calle La Torre 34", coste: 74.0, duracion: "2:15:00" },
  { nombre: "Downtown La Torre Penthouse", codigo: "LT34.3", direccion: "Calle La Torre 34", coste: 90.0, duracion: "3:00:00" },
  { nombre: "Main Street Deluxe Apartment 1", codigo: "MD18.1", direccion: "Medico Duran 18", coste: 60.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Apartment 1B", codigo: "MD18.1B", direccion: "Pasadizo Pernas 11-13", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Apartment 2A", codigo: "MD18.2A", direccion: "Pasadizo Pernas 11-13", coste: 80.0, duracion: "2:15:00" },
  { nombre: "Main Street Deluxe Apartment 2B", codigo: "MD18.2B", direccion: "Pasadizo Pernas 11-13", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Apartment 3", codigo: "MD18.3", direccion: "Medico Duran 18", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Apartment 3B", codigo: "MD18.3B", direccion: "Pasadizo Pernas 11-13", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Apartment 4", codigo: "MD18.4", direccion: "MEDICO DURAN 18", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Apartment 4B", codigo: "MD18.4B", direccion: "Pasadizo Pernas 11-13", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Penthouse", codigo: "MD18.5", direccion: "MEDICO DURAN 18", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Main Street Deluxe Penthouse A", codigo: "MD18.5A", direccion: "Pasadizo Pernas 11-13", coste: 80.0, duracion: "2:15:00" },
  { nombre: "Main Street Deluxe Penthouse B", codigo: "MD18.5B", direccion: "Pasadizo Pernas 11-13", coste: 70.0, duracion: "1:45:00" },
  { nombre: "Metropolitan Boutique Apt 1", codigo: "MR16.1", direccion: "Calle Médico Rodríguez 16", coste: 75.0, duracion: "2:45:00" },
  { nombre: "Metropolitan Boutique Apt 2", codigo: "MR16.2", direccion: "Médico Rodríguez 16", coste: 70.0, duracion: "2:30:00" },
  { nombre: "Metropolitan Boutique Penthouse", codigo: "MR16.6", direccion: "MÉDICO RODRÍGUEZ 16", coste: 92.0, duracion: "3:00:00" },
  { nombre: "Metropolitan Boutique Studio 3", codigo: "MR16.3", direccion: "MÉDICO RODRIGUEZ 16", coste: 65.0, duracion: "2:30:00" },
  { nombre: "Metropolitan Boutique Studio 4", codigo: "MR16.4", direccion: "Médico Rodríguez 16", coste: 65.0, duracion: "2:30:00" },
  { nombre: "Metropolitan Boutique Studio 5", codigo: "MR16.5", direccion: "Médico Rodríguez 16", coste: 65.0, duracion: "2:30:00" },
  { nombre: "Ocean View Penthouse", codigo: "FR3.5D", direccion: "Rúa Fonte de Ramos, 3 5º D", coste: 0.0, duracion: "2:15:00" },
  { nombre: "Old Quarter Boutique Apartment 1", codigo: "PA10.1", direccion: "Puerta de Aires 10", coste: 36.0, duracion: "1:00:00" },
  { nombre: "Old Quarter Boutique Apartment 2", codigo: "PA10.2", direccion: "Puerta de Aires 10", coste: 36.0, duracion: "1:00:00" },
  { nombre: "Old Quarter Boutique Apartment 3", codigo: "PA10.3", direccion: "Puerta de aires 10", coste: 36.0, duracion: "1:00:00" },
  { nombre: "Orzan Beach Surf Apartment", codigo: "SS13.1B", direccion: "Salgado Somoza 13", coste: 46.0, duracion: "1:30:00" },
  { nombre: "Orzan Deluxe Apartment", codigo: "CP12.1C", direccion: "Calle Perillana, 12", coste: 42.0, duracion: "1:30:00" },
  { nombre: "Orzan Deluxe Penthouse", codigo: "CP12.4B", direccion: "Calle Perillana 12", coste: 52.0, duracion: "1:45:00" },
  { nombre: "Prioral Countryside Villa", codigo: "PRIORAL", direccion: "Aldea Graña, 3, 15635 Miño, A Coruña, España", coste: 225.0, duracion: "2:00:00" },
  { nombre: "Quiet and Cozy Downtown Apartment", codigo: "CAV13", direccion: "Calle Alfonso VII 13, 2 Izq", coste: 46.0, duracion: "1:00:00" },
  { nombre: "Riazor Deluxe Penthouse", codigo: "AV11.6", direccion: "Alfredo Vicenti, 11", coste: 110.0, duracion: "3:30:00" },
  { nombre: "Riazor Ocean View Apartment", codigo: "ASR5.1A", direccion: "Avenida de San Roque de Afuera, 5", coste: 70.0, duracion: "2:30:00" },
  { nombre: "San Amaro Beach Apartment 5", codigo: "SA6.5C", direccion: "Calle San Amaro 6", coste: 66.0, duracion: "2:00:00" },
  { nombre: "Santa Lucia Apartment 1", codigo: "AB1.1B", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:45:00" },
  { nombre: "Santa Lucia Apartment 2", codigo: "AB1.2B", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:45:00" },
  { nombre: "Santa Lucia Apartment 3", codigo: "AB1.3B", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:45:00" },
  { nombre: "Santa Lucia Apartment 4", codigo: "AB1.4B", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:45:00" },
  { nombre: "Santa Lucia Apartment 5", codigo: "AB1.5B", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:45:00" },
  { nombre: "Santa Lucia Gallery Apartment 1", codigo: "AB1.1A", direccion: "Calle Argudin Bolivar 1", coste: 70.0, duracion: "2:00:00" },
  { nombre: "Santa Lucia Gallery Apartment 2", codigo: "AB1.2A", direccion: "Calle Argudin Bolivar 1", coste: 70.0, duracion: "2:00:00" },
  { nombre: "Santa Lucia Gallery Apartment 3", codigo: "AB1.3A", direccion: "Calle Argudin Bolivar 1", coste: 70.0, duracion: "2:00:00" },
  { nombre: "Santa Lucia Terrace Penthouse", codigo: "AB1.4A", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:30:00" },
  { nombre: "Santa Lucia Terrace Rooftop", codigo: "AB1.5A", direccion: "Calle Argudin Bolivar 1", coste: 65.0, duracion: "1:30:00" }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando inserción de propiedades...');

    // Primero necesitamos obtener un cliente genérico para asociar las propiedades
    // Si no hay clientes, creamos uno por defecto
    let { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .limit(1);

    if (clientError) {
      console.error('Error obteniendo clientes:', clientError);
      throw clientError;
    }

    let clienteId: string;

    if (!clients || clients.length === 0) {
      // Crear cliente por defecto
      const { data: newClient, error: createClientError } = await supabase
        .from('clients')
        .insert({
          nombre: 'Blue Ocean Properties',
          cif_nif: 'B00000000',
          telefono: '+34000000000',
          email: 'dgomezlimpatex@gmail.com',
          direccion_facturacion: 'A Coruña, España',
          tipo_servicio: 'limpieza',
          ciudad: 'A Coruña',
          codigo_postal: '15001',
          supervisor: 'David Gómez',
          metodo_pago: 'transferencia',
          factura: true
        })
        .select('id')
        .single();

      if (createClientError) {
        console.error('Error creando cliente por defecto:', createClientError);
        throw createClientError;
      }

      clienteId = newClient.id;
    } else {
      clienteId = clients[0].id;
    }

    console.log(`Usando cliente ID: ${clienteId}`);

    const propertiesToInsert = properties.map(prop => ({
      codigo: prop.codigo,
      nombre: prop.nombre,
      direccion: prop.direccion,
      numero_camas: 1, // Valor por defecto
      numero_banos: 1, // Valor por defecto
      duracion_servicio: timeToMinutes(prop.duracion),
      coste_servicio: prop.coste,
      check_in_predeterminado: '15:00:00',
      check_out_predeterminado: '11:00:00',
      numero_sabanas: 0,
      numero_toallas_grandes: 0,
      numero_toallas_pequenas: 0,
      numero_alfombrines: 0,
      numero_fundas_almohada: 0,
      notas: '',
      cliente_id: clienteId,
      hostaway_internal_name: prop.nombre
    }));

    const { data: insertedProperties, error: insertError } = await supabase
      .from('properties')
      .insert(propertiesToInsert)
      .select();

    if (insertError) {
      console.error('Error insertando propiedades:', insertError);
      throw insertError;
    }

    console.log(`✅ Se insertaron ${insertedProperties.length} propiedades exitosamente`);

    return new Response(JSON.stringify({
      success: true,
      message: `Se insertaron ${insertedProperties.length} propiedades exitosamente`,
      properties: insertedProperties
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error en la inserción:', error);
    
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
