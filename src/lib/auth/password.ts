import { compare } from "bcryptjs";

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await compare(password, storedHash);
  } catch {
    return false;
  }
}
