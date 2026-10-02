/**
 * lib/validators/numeric.ts
 *
 * Validadores Zod compartidos para campos numericos del modulo de pagos y
 * cortes. Antes cada ruta validaba a mano con `!body.amount` o similar,
 * dejando pasar montos negativos o cero.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   El server debe rechazar `amount <= 0` y `0 <= retentionPercent <= 100`.
 *   El neto de un corte puede ser negativo si el anticipo supera al
 *   bruto, asi que ese campo se valida por separado en cuts-workflow.
 */

import { z } from "zod";

/** Monto monetario: numero finito > 0. */
export const positiveAmount = z
  .number()
  .finite("El monto debe ser un numero valido")
  .positive("El monto debe ser mayor a 0");

/** Porcentaje de retencion entre 0 y 100 (inclusivo). */
export const retentionPercent = z
  .number()
  .finite("La retencion debe ser un numero valido")
  .min(0, "La retencion no puede ser negativa")
  .max(100, "La retencion no puede superar 100%");

/** Anticipo descontado: 0 o mayor, sin tope superior aqui. */
export const advanceDeduction = z
  .number()
  .finite("El anticipo debe ser un numero valido")
  .min(0, "El anticipo no puede ser negativo");

/**
 * Esquema completo para la creacion de un pago. Pensado para correr
 * despues de verificar que el body trae los campos obligatorios basicos
 * (projectId, beneficiaryName, etc.) y antes de insertar.
 */
export const paymentAmountSchema = z.object({
  amount: positiveAmount,
});

export const cutMonetarySchema = z.object({
  retentionPercent,
  advanceDeduction,
});
