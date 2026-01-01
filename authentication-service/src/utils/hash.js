import bcrypt from "bcryptjs";

const hashWithRounds = async (plain, rounds) => {
  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plain, salt);
};

export const hashPassword = async (plain) => {
  return hashWithRounds(plain, 10);
};

export const hashOtp = async (plain) => {
  // Slightly lower cost for short-lived OTPs while still avoiding plaintext storage
  return hashWithRounds(plain, 8);
};

export const comparePassword = async (plain, hashed) => {
  return bcrypt.compare(plain, hashed);
};

export const compareSecret = comparePassword;
