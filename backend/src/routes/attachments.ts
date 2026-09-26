import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import type { AttachmentRow } from '../types.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

const META_COLS =
  'id, patient_id, exam_order_id, filename, mime, size, label, uploaded_by, created_at';

export async function attachmentRoutes(app: FastifyInstance): Promise<void> {
  // Pièces jointes médicales — réservé au personnel médical.
  const guard = { preHandler: [app.authenticate, app.requireMedecin] };

  // Liste des pièces jointes d'un patient (sans le contenu).
  app.get('/patients/:id/attachments', guard, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(id))) {
      throw notFound('Patient introuvable');
    }
    return db
      .prepare(
        `SELECT a.id, a.patient_id, a.exam_order_id, a.filename, a.mime, a.size,
                a.label, a.uploaded_by, a.created_at, u.name AS uploaded_by_name
         FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
         WHERE a.patient_id = ? ORDER BY a.created_at DESC`,
      )
      .all(Number(id));
  });

  // Téléversement d'un fichier (multipart) : champ fichier + champs label / exam_order_id.
  app.post('/patients/:id/attachments', guard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(Number(id))) {
      throw notFound('Patient introuvable');
    }

    const data = await req.file();
    if (!data) throw badRequest('Aucun fichier reçu.');

    if (!ALLOWED_MIME.has(data.mimetype)) {
      throw badRequest('Type de fichier non autorisé (PDF ou image attendus).');
    }

    // Champs texte accompagnant le fichier.
    const label = (data.fields?.label as { value?: string } | undefined)?.value?.trim() || null;
    const examRaw = (data.fields?.exam_order_id as { value?: string } | undefined)?.value;
    const examOrderId = examRaw && /^\d+$/.test(examRaw) ? Number(examRaw) : null;

    const buffer = await data.toBuffer();
    if (buffer.length === 0) throw badRequest('Fichier vide.');
    if (buffer.length > MAX_BYTES) throw badRequest('Fichier trop volumineux (max 10 Mo).');
    // data.file.truncated est vrai si la limite multipart a coupé le flux.
    if (data.file.truncated) throw badRequest('Fichier trop volumineux (max 10 Mo).');

    if (examOrderId) {
      const exam = db
        .prepare('SELECT id, patient_id FROM exam_orders WHERE id = ?')
        .get(examOrderId) as { id: number; patient_id: number } | undefined;
      if (!exam || exam.patient_id !== Number(id)) {
        throw badRequest('Examen prescrit invalide pour ce patient.');
      }
    }

    const insert = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO attachments (patient_id, exam_order_id, filename, mime, size, label, content, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number(id),
          examOrderId,
          data.filename,
          data.mimetype,
          buffer.length,
          label,
          buffer,
          req.user.id,
        );
      // Un résultat rattaché à un examen prescrit le marque « réalisé ».
      if (examOrderId) {
        db.prepare("UPDATE exam_orders SET status = 'REALISE' WHERE id = ?").run(examOrderId);
      }
      return Number(info.lastInsertRowid);
    });
    const newId = insert();

    reply.code(201);
    return db.prepare(`SELECT ${META_COLS} FROM attachments WHERE id = ?`).get(newId);
  });

  // Téléchargement / affichage du fichier.
  app.get('/attachments/:aid/download', guard, async (req, reply) => {
    const { aid } = req.params as { aid: string };
    const row = getDb()
      .prepare(`SELECT filename, mime, content FROM attachments WHERE id = ?`)
      .get(Number(aid)) as { filename: string; mime: string; content: Buffer } | undefined;
    if (!row) throw notFound('Pièce jointe introuvable');
    reply
      .header('Content-Disposition', `inline; filename="${row.filename.replace(/"/g, '')}"`)
      .type(row.mime);
    return reply.send(row.content);
  });

  // Suppression : l'auteur du téléversement ou un admin.
  app.delete('/attachments/:aid', guard, async (req) => {
    const { aid } = req.params as { aid: string };
    const db = getDb();
    const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(aid)) as
      | AttachmentRow
      | undefined;
    if (!row) throw notFound('Pièce jointe introuvable');
    if (req.user.role !== 'ADMIN' && row.uploaded_by !== req.user.id) {
      throw forbidden('Seul l’auteur ou un administrateur peut supprimer ce fichier.');
    }
    db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id);
    return { deleted: true };
  });
}
