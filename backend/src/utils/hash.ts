import brypt from 'bcrypt';

export async function hashPasswordUtils(
  plainPassword: string,
): Promise<string> {
  const saltRounds = 10;
  try {
    return await brypt.hash(plainPassword, saltRounds);
  } catch (error) {
    console.error('Error generating salt:', error);
    throw error;
  }
}

export async function comparePasswordUtils(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    const isMatch = await brypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw error;
  }
}
