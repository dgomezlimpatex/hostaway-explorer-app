import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    const jwt = authHeader?.replace('Bearer ', '')
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    )

    const { action, payload } = await req.json()

    if (!action) throw new Error('action is required')

    // Authorization: only admin/manager/logistics
    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: isAdminMgr } = await supabaseUser.rpc('user_is_admin_or_manager')
    let allowed = Boolean(isAdminMgr)
    if (!allowed) {
      const { data: isLogistics } = await supabaseUser.rpc('user_has_role', { check_role: 'logistics' })
      allowed = Boolean(isLogistics)
    }
    if (!allowed) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    switch (action) {
      case 'generate_from_properties': {
        const { picklistId, propertyIds } = payload || {}
        if (!picklistId || !Array.isArray(propertyIds) || propertyIds.length === 0) {
          throw new Error('picklistId and propertyIds[] are required')
        }

        let created = 0, updated = 0

        // Obtener productos de inventario para mapear con las características
        const { data: products, error: prodErr } = await supabaseService
          .from('inventory_products')
          .select('id, name')
          .eq('is_active', true)

        if (prodErr) throw prodErr

        // Procesar cada propiedad
        for (const propertyId of propertyIds) {
          const { data: property, error: propErr } = await supabaseService
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single()

          if (propErr) throw propErr

          // Crear array de productos para esta propiedad
          const propertyProducts = []
          
          // Mapeo de características de propiedad a productos de inventario
          const propertyItems = [
            { name: 'sabanas', quantity: property.numero_sabanas },
            { name: 'sabanas pequeñas', quantity: property.numero_sabanas_pequenas },
            { name: 'sabanas suite', quantity: property.numero_sabanas_suite },
            { name: 'toallas grandes', quantity: property.numero_toallas_grandes },
            { name: 'toallas pequeñas', quantity: property.numero_toallas_pequenas },
            { name: 'alfombrines', quantity: property.numero_alfombrines },
            { name: 'fundas almohada', quantity: property.numero_fundas_almohada },
            { name: 'papel higienico', quantity: property.cantidad_rollos_papel_higienico },
            { name: 'papel cocina', quantity: property.cantidad_rollos_papel_cocina },
            { name: 'kit alimentario', quantity: property.kit_alimentario },
            { name: 'amenities baño', quantity: property.amenities_bano },
            { name: 'amenities cocina', quantity: property.amenities_cocina },
          ]

          let totalItems = 0

          for (const item of propertyItems) {
            if (item.quantity <= 0) continue

            // Buscar producto correspondiente en inventario
            const product = products?.find(p => 
              p.name.toLowerCase().includes(item.name.toLowerCase()) ||
              item.name.toLowerCase().includes(p.name.toLowerCase())
            )

            if (product) {
              propertyProducts.push({
                product_id: product.id,
                product_name: product.name,
                quantity: item.quantity
              })
              totalItems += item.quantity
            }
          }

          if (propertyProducts.length === 0) continue

          // Ver si ya existe un paquete para esta propiedad
          const { data: existing, error: exErr } = await supabaseService
            .from('logistics_picklist_items')
            .select('id, quantity, products_summary')
            .eq('picklist_id', picklistId)
            .eq('property_id', propertyId)
            .eq('is_property_package', true)
            .maybeSingle()

          if (exErr) throw exErr

          if (existing) {
            // Actualizar paquete existente
            const { error: upErr } = await supabaseService
              .from('logistics_picklist_items')
              .update({ 
                quantity: (existing.quantity || 0) + totalItems,
                products_summary: propertyProducts
              })
              .eq('id', existing.id)
            if (upErr) throw upErr
            updated++
          } else {
            // Crear nuevo paquete para la propiedad
            const { error: insErr } = await supabaseService
              .from('logistics_picklist_items')
              .insert({
                picklist_id: picklistId,
                product_id: propertyProducts[0].product_id, // Usar el primer producto como referencia
                quantity: totalItems,
                property_id: propertyId,
                is_property_package: true,
                products_summary: propertyProducts
              })
            if (insErr) throw insErr
            created++
          }
        }

        return new Response(JSON.stringify({ ok: true, created, updated }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      case 'generate_from_tasks': {
        const { picklistId, startDate, endDate } = payload || {}
        if (!picklistId || !startDate || !endDate) {
          throw new Error('picklistId, startDate, endDate are required')
        }

        // Obtener tareas en rango y contar por propiedad
        const { data: tasks, error: tErr } = await supabaseService
          .from('tasks')
          .select('propiedad_id, status, date')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('status', ['pending', 'in-progress'])

        if (tErr) throw tErr

        const counts = new Map<string, number>()
        for (const t of tasks || []) {
          if (!t.propiedad_id) continue
          counts.set(t.propiedad_id, (counts.get(t.propiedad_id) || 0) + 1)
        }

        let created = 0, updated = 0

        // Obtener productos de inventario para mapear
        const { data: products, error: prodErr } = await supabaseService
          .from('inventory_products')
          .select('id, name')
          .eq('is_active', true)

        if (prodErr) throw prodErr

        for (const [propertyId, taskCount] of counts.entries()) {
          // Obtener características de la propiedad
          const { data: property, error: propErr } = await supabaseService
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single()

          if (propErr) throw propErr

          // Crear array de productos para esta propiedad
          const propertyProducts = []
          
          // Mapeo de características de propiedad a productos de inventario
          const propertyItems = [
            { name: 'sabanas', quantity: property.numero_sabanas },
            { name: 'sabanas pequeñas', quantity: property.numero_sabanas_pequenas },
            { name: 'sabanas suite', quantity: property.numero_sabanas_suite },
            { name: 'toallas grandes', quantity: property.numero_toallas_grandes },
            { name: 'toallas pequeñas', quantity: property.numero_toallas_pequenas },
            { name: 'alfombrines', quantity: property.numero_alfombrines },
            { name: 'fundas almohada', quantity: property.numero_fundas_almohada },
            { name: 'papel higienico', quantity: property.cantidad_rollos_papel_higienico },
            { name: 'papel cocina', quantity: property.cantidad_rollos_papel_cocina },
            { name: 'kit alimentario', quantity: property.kit_alimentario },
            { name: 'amenities baño', quantity: property.amenities_bano },
            { name: 'amenities cocina', quantity: property.amenities_cocina },
          ]

          let totalItems = 0

          for (const item of propertyItems) {
            if (item.quantity <= 0) continue

            // Buscar producto correspondiente en inventario
            const product = products?.find(p => 
              p.name.toLowerCase().includes(item.name.toLowerCase()) ||
              item.name.toLowerCase().includes(p.name.toLowerCase())
            )

            if (product) {
              const itemQuantity = item.quantity * taskCount
              propertyProducts.push({
                product_id: product.id,
                product_name: product.name,
                quantity: itemQuantity
              })
              totalItems += itemQuantity
            }
          }

          if (propertyProducts.length === 0) continue

          // Ver si ya existe un paquete para esta propiedad
          const { data: existing, error: exErr } = await supabaseService
            .from('logistics_picklist_items')
            .select('id, quantity, products_summary')
            .eq('picklist_id', picklistId)
            .eq('property_id', propertyId)
            .eq('is_property_package', true)
            .maybeSingle()

          if (exErr) throw exErr

          if (existing) {
            // Actualizar paquete existente
            const { error: upErr } = await supabaseService
              .from('logistics_picklist_items')
              .update({ 
                quantity: (existing.quantity || 0) + totalItems,
                products_summary: propertyProducts
              })
              .eq('id', existing.id)
            if (upErr) throw upErr
            updated++
          } else {
            // Crear nuevo paquete para la propiedad
            const { error: insErr } = await supabaseService
              .from('logistics_picklist_items')
              .insert({
                picklist_id: picklistId,
                product_id: propertyProducts[0].product_id, // Usar el primer producto como referencia
                quantity: totalItems,
                property_id: propertyId,
                is_property_package: true,
                products_summary: propertyProducts
              })
            if (insErr) throw insErr
            created++
          }
        }

        return new Response(JSON.stringify({ ok: true, created, updated, properties: counts.size, tasks: (tasks || []).length }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      case 'mark_packed': {
        const { picklistId } = payload || {}
        if (!picklistId) throw new Error('picklistId is required')

        const { error } = await supabaseService
          .from('logistics_picklists')
          .update({ status: 'packed' })
          .eq('id', picklistId)

        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
      }

      case 'create_delivery_from_picklist': {
        const { picklistId } = payload || {}
        if (!picklistId) throw new Error('picklistId is required')

        // Crear entrega
        const { data: delivery, error: delErr } = await supabaseService
          .from('logistics_deliveries')
          .insert({ picklist_id: picklistId, status: 'planned' })
          .select('id')
          .single()

        if (delErr) throw delErr

        // Obtener items de picklist agrupados por propiedad
        const { data: items, error: itemsErr } = await supabaseService
          .from('logistics_picklist_items')
          .select('product_id, quantity, property_id')
          .eq('picklist_id', picklistId)

        if (itemsErr) throw itemsErr

        // Crear paradas por propiedad
        const propertyIds = Array.from(new Set((items || []).map(i => i.property_id).filter(Boolean))) as string[]

        for (const propId of propertyIds) {
          const { data: stop, error: stopErr } = await supabaseService
            .from('logistics_delivery_stops')
            .insert({ delivery_id: delivery.id, property_id: propId })
            .select('id')
            .single()
          if (stopErr) throw stopErr

          const itemsForProperty = (items || []).filter(i => i.property_id === propId)
          for (const it of itemsForProperty) {
            const { error: diErr } = await supabaseService
              .from('logistics_delivery_items')
              .insert({ stop_id: stop.id, product_id: it.product_id, quantity: it.quantity })
            if (diErr) throw diErr
          }
        }

        // Marcar picklist como committed (confirmado)
        await supabaseService
          .from('logistics_picklists')
          .update({ status: 'committed' })
          .eq('id', picklistId)

        return new Response(JSON.stringify({ ok: true, deliveryId: delivery.id, stops: propertyIds.length }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (e: any) {
    console.error('logistics-operations error', e)
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})
