/** 접근 비밀번호 검증. ACCESS_PASSWORD 미설정 시 항상 true 반환 */
export function verifyAccessPassword(password?: string): boolean {
  const serverPassword = process.env.ACCESS_PASSWORD?.trim();
  if (!serverPassword) return true; // 비밀번호 미설정 → 전체 허용
  return (password?.trim() ?? "") === serverPassword;
}
