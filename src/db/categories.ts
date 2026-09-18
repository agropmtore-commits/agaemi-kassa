import { db, newId, type Category, type CategoryType, type KassaDB } from './schema';

export interface CategoryInput {
  type: CategoryType;
  name: string;
  icon: string;
  color: string;
}

export async function createCategory(input: CategoryInput, database: KassaDB = db): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Kateqoriya adı boşdur');
  const count = await database.categories.where('type').equals(input.type).count();
  const category: Category = {
    id: newId(),
    type: input.type,
    name,
    icon: input.icon || '📦',
    color: input.color,
    sort_order: count,
    is_archived: 0,
    is_system: 0,
  };
  await database.categories.add(category);
  return category;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'sort_order'>>,
  database: KassaDB = db,
): Promise<void> {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Kateqoriya adı boşdur');
  await database.categories.update(id, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) });
}

/** Silmə = arxiv (köhnə əməliyyatlar pozulmasın). Sistem kateqoriyası arxivlənmir. */
export async function setCategoryArchived(id: string, archived: boolean, database: KassaDB = db): Promise<void> {
  const cat = await database.categories.get(id);
  if (!cat) throw new Error('Kateqoriya tapılmadı');
  if (cat.is_system && archived) throw new Error('Sistem kateqoriyası arxivlənmir');
  await database.categories.update(id, { is_archived: archived ? 1 : 0 });
}

/** Kateqoriya üzrə əməliyyat sayı — arxivləmə dialoqunda göstərmək üçün. */
export function countCategoryTransactions(id: string, database: KassaDB = db): Promise<number> {
  return database.transactions.where('category_id').equals(id).count();
}
