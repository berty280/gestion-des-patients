import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getClinicInfo, setSetting } from '../services/settings.js';
import { badRequest } from '../lib/errors.js';
import { parse } from '../lib/validate.js';

// Logo : image en data URL (base64), ~350 000 caractères max (~256 Ko).
const MAX_LOGO = 350_000;
const logoSchema = z
  .string()
  .refine((v) => v === '' || /^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/.test(v), {
    message: 'Logo : image invalide (png, jpeg, svg ou webp attendus).',
  })
  .refine((v) => v.length <= MAX_LOGO, { message: 'Logo trop volumineux (max ~256 Ko).' });

const updateSchema = z.object({
  clinicName: z.string().trim().min(1).max(200).optional(),
  clinicAddress: z.string().trim().max(300).optional(),
  clinicPhone: z.string().trim().max(60).optional(),
  clinicLogo: logoSchema.optional(), // '' pour retirer le logo
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Lecture (admin) — la version publique est servie par /config.
  app.get(
    '/settings',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async () => getClinicInfo(),
  );

  app.patch(
    '/settings',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async (req) => {
      const body = parse(updateSchema, req.body);
      if (Object.keys(body).length === 0) throw badRequest('Aucun paramètre fourni.');
      if (body.clinicName !== undefined) setSetting('clinic_name', body.clinicName);
      if (body.clinicAddress !== undefined) setSetting('clinic_address', body.clinicAddress);
      if (body.clinicPhone !== undefined) setSetting('clinic_phone', body.clinicPhone);
      if (body.clinicLogo !== undefined) {
        setSetting('clinic_logo', body.clinicLogo === '' ? null : body.clinicLogo);
      }
      return getClinicInfo();
    },
  );
}
