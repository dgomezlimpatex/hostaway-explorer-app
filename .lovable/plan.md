

## Plan: Notificaciones por Email de Reservas del Portal de Clientes

### Resumen

Implementar un sistema de notificaciones por email usando Resend que te avise cuando los clientes añadan reservas a través de su portal. El sistema enviará un resumen cada 3 horas (de 9:00 a 21:00) con todas las reservas añadidas en ese periodo.

---

### Cómo Funcionará

1. Cada 3 horas (9:00, 12:00, 15:00, 18:00, 21:00), el sistema verificará si hay nuevas reservas
2. Buscará en los logs de reservas las creadas en las últimas 3 horas
3. Si hay reservas nuevas, te enviará un email con el formato:
   - **Cliente** - **Propiedad** - **Fecha de salida**
4. Si no hay reservas nuevas en ese periodo, no se enviará email

---

### Ejemplo del Email

```
📋 Nuevas Reservas del Portal de Clientes

Se han añadido 3 reservas en las últimas 3 horas:

• Apartamentos López - Marina 5A - Salida: 15/02/2026
• Apartamentos López - Playa 2B - Salida: 18/02/2026  
• Gestión Turística SL - Centro 1 - Salida: 20/02/2026

---
Resumen automático del Sistema de Gestión
```

---

### Requisito Previo

Necesitaré que añadas la clave de API de Resend como secreto:
- **Nombre**: `RESEND_API_KEY`
- **Valor**: Tu clave API de Resend

Ya tienes Resend configurado para otros emails (asignación de tareas, invitaciones, etc.), así que probablemente ya tengas este secreto. Si no lo tienes, puedes obtener la clave en https://resend.com/api-keys

---

### Detalles Técnicos

#### 1. Nueva Edge Function: `send-reservation-digest-email`

Creará una función que:
- Consulte `client_reservation_logs` para obtener reservas creadas en las últimas 3 horas
- Agrupe la información por cliente y propiedad
- Envíe un email formateado a dgomezlimpatex@gmail.com
- Solo envíe si hay al menos una reserva nueva

```text
┌─────────────────────────────────────────────────────────────┐
│                    Edge Function Flow                        │
├─────────────────────────────────────────────────────────────┤
│  1. Recibe llamada del cron job                             │
│  2. Calcula ventana de tiempo (últimas 3 horas)             │
│  3. Consulta client_reservation_logs WHERE action='created' │
│  4. JOIN con clients y properties para obtener nombres      │
│  5. Si hay resultados → genera email con lista              │
│  6. Envía email via Resend                                  │
│  7. Retorna éxito/error                                     │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Configuración del Cron Job

Se programará para ejecutarse cada 3 horas dentro del horario de 9:00 a 21:00:

| Hora | Cron Expression |
|------|-----------------|
| 9:00, 12:00, 15:00, 18:00, 21:00 | `0 9,12,15,18,21 * * *` |

#### 3. Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `supabase/functions/send-reservation-digest-email/index.ts` | Crear |
| `supabase/config.toml` | Añadir configuración de la función |
| SQL para cron job | Ejecutar para programar el trigger |

---

### Notas Adicionales

- El email se enviará desde `noreply@limpatexgestion.com` (dominio ya verificado en Resend)
- El formato del email será similar al de las notificaciones de tareas existentes
- Si no hay reservas nuevas en un periodo de 3 horas, no recibirás email (para no saturar tu bandeja)

