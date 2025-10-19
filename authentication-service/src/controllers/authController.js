export const requestOtp = (req, res) => {
  const { email } = req.body;
  console.log(`OTP requested for ${email}`);
  res.json({ message: "OTP sent (mock)" });
};

export const verifyOtp = (req, res) => {
  const { email, code } = req.body;
  console.log(`Verifying OTP for ${email}, code=${code}`);
  res.json({ message: "OTP verified (mock)" });
};
