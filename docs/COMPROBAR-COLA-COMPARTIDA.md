# Comprobar la cola compartida sin operaciones de negocio

Esta prueba coordina una entrega revisada de documentación y una entrega automática pendiente. No necesita SQL, sesiones reales, cambios de stock ni envíos.

1. Revisar la PR de documentación y sus comprobaciones. Reservar el turno con el commit exacto y la autorización para probar el circuito.
2. Confirmar que la reserva está active. Solicitar la entrega automática mientras se conserva la reserva; su workflow debe permanecer pendiente y no incorporar la PR.
3. Incorporar únicamente la documentación revisada y ejecutar ready. El workflow revisado debe publicar el commit incorporado y confirmar ambos dominios y assets antes de cerrar la reserva.
4. Comprobar que la entrega automática comienza después, valida sobre main actualizado y conserva lo publicado anteriormente.

Si falla la entrega revisada, no liberar la cola sin comprobar posibles efectos parciales. Una prueba de documentación no valida los efectos operativos de una futura migración o envío real.
