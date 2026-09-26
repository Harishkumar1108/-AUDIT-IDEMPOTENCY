/**
 * Diverse Indian Names Pool for Natural Transaction Generation
 */
export const INDIAN_NAMES_POOL = [
  'Aarav Sharma',
  'Ananya Iyer',
  'Vikram Patel',
  'Neha Gupta',
  'Rohan Joshi',
  'Priya Nair',
  'Kabir Mehta',
  'Pooja Deshmukh',
  'Rahul Verma',
  'Sneha Reddy',
  'Arjun Nair',
  'Kavita Rao',
  'Amit Deshmukh',
  'Diya Sen',
  'Manish Kumar',
];

export function getRandomCustomerName(exclude: string[] = []): string {
  const available = INDIAN_NAMES_POOL.filter((name) => !exclude.includes(name));
  const pool = available.length > 0 ? available : INDIAN_NAMES_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getShuffledCustomerNames(count: number): string[] {
  const shuffled = [...INDIAN_NAMES_POOL].sort(() => 0.5 - Math.random());
  const result: string[] = [];
  while (result.length < count) {
    for (const name of shuffled) {
      if (result.length < count) {
        result.push(name);
      }
    }
  }
  return result;
}
