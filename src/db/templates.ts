import { db, newId, type KassaDB, type Template } from './schema';

// README §5.3 — sürətli şablonlar: ad, növ, məbləğ (istəyə bağlı), kateqoriya, cüzdan, qeyd.

export type TemplateInput = Pick<Template, 'name' | 'type'> & Partial<Pick<Template, 'amount' | 'category_id' | 'wallet_id' | 'note'>>;

function normalize(input: TemplateInput): TemplateInput {
  const name = input.name.trim();
  if (!name) throw new Error('Şablon adı boşdur');
  if (input.amount !== undefined && (!Number.isInteger(input.amount) || input.amount < 0)) throw new Error('Məbləğ yanlışdır');
  const note = input.note?.trim();
  return {
    name,
    type: input.type,
    ...(input.amount ? { amount: input.amount } : {}),
    ...(input.category_id ? { category_id: input.category_id } : {}),
    ...(input.wallet_id ? { wallet_id: input.wallet_id } : {}),
    ...(note ? { note } : {}),
  };
}

export async function createTemplate(input: TemplateInput, database: KassaDB = db): Promise<Template> {
  const count = await database.templates.count();
  const template: Template = { id: newId(), ...normalize(input), sort_order: count, use_count: 0 };
  await database.templates.add(template);
  return template;
}

/** Götürülən sahələr (məs. məbləğ silindi) put ilə həqiqətən silinir. */
export async function updateTemplate(id: string, input: TemplateInput, database: KassaDB = db): Promise<void> {
  const existing = await database.templates.get(id);
  if (!existing) throw new Error('Şablon tapılmadı');
  await database.templates.put({ id, ...normalize(input), sort_order: existing.sort_order, use_count: existing.use_count });
}

export async function deleteTemplate(id: string, database: KassaDB = db): Promise<void> {
  await database.templates.delete(id);
}

/** Hər istifadədə sayğac artır — ən çox istifadə olunanlar önə çıxır. */
export async function bumpTemplateUse(id: string, database: KassaDB = db): Promise<void> {
  const existing = await database.templates.get(id);
  if (existing) await database.templates.update(id, { use_count: existing.use_count + 1 });
}

/** Sıralama: çox istifadə olunan əvvəl, bərabərdirsə yaradılma sırası. */
export function sortTemplates(templates: Template[]): Template[] {
  return [...templates].sort((a, b) => b.use_count - a.use_count || a.sort_order - b.sort_order);
}
