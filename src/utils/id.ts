/** nanoid-lite: 의존성 없는 짧은 ID 생성 */
export function genId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${rand}` : rand;
}
